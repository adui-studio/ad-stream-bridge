import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';
import { env } from '../../config/env.js';
import { FfmpegSession, type FfmpegSessionSnapshot } from './ffmpeg-session.js';
import { resolveUpstreamDescriptor } from './upstream-key.js';

export interface AttachClientInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
}

interface ManagedSession {
  session: FfmpegSession;
  rtspUrl: string;
  upstreamKey: string;
  createdAt: number;
}

const DEFAULT_RTSP_URL_TEMPLATE = env.rtspUrlTemplate;
const DEFAULT_IDLE_TIMEOUT_MS = env.streamIdleTimeoutMs;
const DEFAULT_SWEEP_INTERVAL_MS = env.streamSweepIntervalMs;

function normalizeNumber(raw: number | undefined, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }

  return fallback;
}

export class StreamManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private readonly idleTimeoutMs: number;
  private readonly sweepIntervalMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;
  private lastSweepAt: number | null = null;

  constructor(options?: { idleTimeoutMs?: number; sweepIntervalMs?: number }) {
    this.idleTimeoutMs = normalizeNumber(options?.idleTimeoutMs, DEFAULT_IDLE_TIMEOUT_MS);
    this.sweepIntervalMs = normalizeNumber(options?.sweepIntervalMs, DEFAULT_SWEEP_INTERVAL_MS);
  }

  attachClient(input: AttachClientInput): void {
    const { streamId, ws, clientIp, rtspUrl } = input;

    const managedSession = this.getOrCreateSession(streamId, rtspUrl);
    const snapshotBeforeAttach = managedSession.session.getSnapshot();

    managedSession.session.attachClient({
      ws,
      clientIp
    });

    const snapshotAfterAttach = managedSession.session.getSnapshot();

    logger.info('stream websocket client connected', {
      streamId,
      sessionId: snapshotAfterAttach.sessionId,
      pid: snapshotAfterAttach.pid,
      reason: 'ws_connect',
      clientIp,
      clientCount: snapshotAfterAttach.clientCount
    });

    if (snapshotBeforeAttach.clientCount === 0) {
      managedSession.session.start();
    }

    this.ensureSweepStarted();

    try {
      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          message: 'live websocket connected',
          rtspUrlSource: rtspUrl ? 'query' : DEFAULT_RTSP_URL_TEMPLATE ? 'template' : 'unknown',
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      const snapshot = managedSession.session.getSnapshot();

      logger.error('stream websocket initial response failed', {
        streamId,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: 'ws_init_send_failed',
        clientIp,
        error
      });

      managedSession.session.detachClient(ws, 'initial message send failed');
      this.cleanupSessionIfIdle(streamId, 'initial_send_failed');
      throw error;
    }

    const cleanupForSocket = (reason: string) => {
      managedSession.session.detachClient(ws, reason);
      this.cleanupSessionIfIdle(streamId, reason);
    };

    ws.on('close', (code, reason) => {
      cleanupForSocket(`websocket close (${code}: ${reason.toString()})`);
    });

    ws.on('error', (error) => {
      const snapshot = managedSession.session.getSnapshot();

      logger.error('stream websocket client error', {
        streamId,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: 'ws_error',
        clientIp,
        error
      });

      cleanupForSocket('websocket error');
    });

    ws.on('message', (message) => {
      const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
      const snapshot = managedSession.session.getSnapshot();

      logger.info('stream websocket client message received', {
        streamId,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: 'ws_message',
        clientIp,
        payload
      });

      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          message: 'live route does not accept upstream control messages yet',
          timestamp: new Date().toISOString()
        })
      );
    });
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getSessionSnapshot(streamId: string): FfmpegSessionSnapshot | null {
    return this.sessions.get(streamId)?.session.getSnapshot() ?? null;
  }

  getAllSessionSnapshots(): FfmpegSessionSnapshot[] {
    return Array.from(this.sessions.values()).map(({ session }) => session.getSnapshot());
  }

  getRuntimeStats(): {
    activeSessionCount: number;
    idleTimeoutMs: number;
    sweepIntervalMs: number;
    lastSweepAt: number | null;
  } {
    return {
      activeSessionCount: this.sessions.size,
      idleTimeoutMs: this.idleTimeoutMs,
      sweepIntervalMs: this.sweepIntervalMs,
      lastSweepAt: this.lastSweepAt
    };
  }

  private getOrCreateSession(streamId: string, rtspUrl?: string): ManagedSession {
    const existing = this.sessions.get(streamId);
    if (existing) {
      return existing;
    }

    const upstream = resolveUpstreamDescriptor({
      streamId,
      directRtspUrl: rtspUrl,
      rtspUrlTemplate: DEFAULT_RTSP_URL_TEMPLATE
    });

    const session = new FfmpegSession({
      streamId,
      rtspUrl: upstream.resolvedRtspUrl
    });

    const managedSession: ManagedSession = {
      session,
      rtspUrl: upstream.resolvedRtspUrl,
      upstreamKey: upstream.upstreamKey,
      createdAt: Date.now()
    };

    this.sessions.set(streamId, managedSession);

    logger.info('stream session created', {
      streamId,
      upstreamKey: upstream.upstreamKey,
      sessionId: session.getSnapshot().sessionId,
      pid: null,
      reason: 'session_create',
      rtspUrl: upstream.resolvedRtspUrl
    });

    return managedSession;
  }

  private cleanupSessionIfIdle(streamId: string, triggerReason = 'idle_cleanup'): void {
    const managedSession = this.sessions.get(streamId);

    if (!managedSession) {
      return;
    }

    const snapshot = managedSession.session.getSnapshot();

    if (snapshot.clientCount > 0) {
      logger.debug?.('stream session cleanup skipped: clients still attached', {
        streamId,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: triggerReason,
        clientCount: snapshot.clientCount,
        state: snapshot.state
      });
      return;
    }

    managedSession.session.stop('no websocket clients remain');
    this.sessions.delete(streamId);

    logger.info('stream session destroyed', {
      streamId,
      upstreamKey: managedSession.upstreamKey,
      sessionId: snapshot.sessionId,
      pid: snapshot.pid,
      reason: triggerReason,
      rtspUrl: managedSession.rtspUrl,
      createdAt: managedSession.createdAt
    });

    this.maybeStopSweep();
  }

  private ensureSweepStarted(): void {
    if (this.sweepTimer || this.sweepIntervalMs <= 0) {
      return;
    }

    this.sweepTimer = setInterval(() => {
      this.runSweep();
    }, this.sweepIntervalMs);

    logger.info('stream manager started idle sweep loop', {
      streamId: null,
      sessionId: null,
      pid: null,
      reason: 'sweep_loop_start',
      sweepIntervalMs: this.sweepIntervalMs,
      idleTimeoutMs: this.idleTimeoutMs
    });
  }

  private maybeStopSweep(): void {
    if (this.sessions.size > 0 || !this.sweepTimer) {
      return;
    }

    clearInterval(this.sweepTimer);
    this.sweepTimer = null;

    logger.info('stream manager stopped idle sweep loop', {
      streamId: null,
      sessionId: null,
      pid: null,
      reason: 'sweep_loop_stop'
    });
  }

  private runSweep(): void {
    this.lastSweepAt = Date.now();

    for (const [streamId, managedSession] of this.sessions.entries()) {
      const snapshot = managedSession.session.getSnapshot();

      if (snapshot.clientCount === 0) {
        this.cleanupSessionIfIdle(streamId, 'sweep_no_clients');
        continue;
      }

      if (snapshot.state !== 'running') {
        continue;
      }

      const referenceTime = snapshot.lastDataAt ?? snapshot.lastStartedAt;

      if (!referenceTime) {
        continue;
      }

      const idleForMs = Date.now() - referenceTime;

      if (idleForMs < this.idleTimeoutMs) {
        continue;
      }

      logger.warn('stream session idle recovery triggered', {
        streamId,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: 'idle_timeout',
        idleForMs,
        idleTimeoutMs: this.idleTimeoutMs,
        lastDataAt: snapshot.lastDataAt,
        lastStartedAt: snapshot.lastStartedAt,
        restartCount: snapshot.restartCount,
        clientCount: snapshot.clientCount
      });

      managedSession.session.restart(`idle timeout exceeded (${idleForMs}ms)`);
    }
  }
}

export const streamManager = new StreamManager();
