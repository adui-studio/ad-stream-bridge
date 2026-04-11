import { env } from '../../config/env.js';
import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';
import { FfmpegSession, type FfmpegSessionSnapshot } from './ffmpeg-session.js';

export interface AttachClientInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
}

interface ManagedSession {
  session: FfmpegSession;
  rtspUrl: string;
  createdAt: number;
}

const DEFAULT_RTSP_URL_TEMPLATE = env.rtspUrlTemplate;
const DEFAULT_IDLE_TIMEOUT_MS = env.streamIdleTimeoutMs;
const DEFAULT_SWEEP_INTERVAL_MS = env.streamSweepIntervalMs;

function normalizeNumber(raw: string | number | undefined, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }

  if (typeof raw === 'string') {
    const parsed = Number(raw);

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return fallback;
}

function resolveRtspUrl(streamId: string, rtspUrl?: string): string {
  const normalized = rtspUrl?.trim();

  if (normalized) {
    return normalized;
  }

  if (DEFAULT_RTSP_URL_TEMPLATE) {
    return DEFAULT_RTSP_URL_TEMPLATE.replace('{id}', streamId);
  }

  throw new Error(`missing rtsp url for stream ${streamId}`);
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

    logger.info('stream manager attached websocket client', {
      streamId,
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
      logger.error('failed to send live websocket initial message', {
        streamId,
        clientIp,
        error
      });

      managedSession.session.detachClient(ws, 'initial message send failed');
      this.cleanupSessionIfIdle(streamId);
      throw error;
    }

    ws.on('close', (code, reason) => {
      managedSession.session.detachClient(ws, `websocket close (${code}: ${reason.toString()})`);
      this.cleanupSessionIfIdle(streamId);
    });

    ws.on('error', (error) => {
      logger.error('live websocket client error', {
        streamId,
        clientIp,
        error
      });
    });

    ws.on('message', (message) => {
      const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);

      logger.info('live websocket client message received', {
        streamId,
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

    const resolvedRtspUrl = resolveRtspUrl(streamId, rtspUrl);

    const session = new FfmpegSession({
      streamId,
      rtspUrl: resolvedRtspUrl
    });

    const managedSession: ManagedSession = {
      session,
      rtspUrl: resolvedRtspUrl,
      createdAt: Date.now()
    };

    this.sessions.set(streamId, managedSession);

    logger.info('stream manager created ffmpeg session', {
      streamId,
      rtspUrl: resolvedRtspUrl
    });

    return managedSession;
  }

  private cleanupSessionIfIdle(streamId: string): void {
    const managedSession = this.sessions.get(streamId);

    if (!managedSession) {
      return;
    }

    const snapshot = managedSession.session.getSnapshot();

    if (snapshot.clientCount > 0) {
      return;
    }

    managedSession.session.stop('no websocket clients remain');
    this.sessions.delete(streamId);

    logger.info('stream manager removed idle ffmpeg session', {
      streamId,
      rtspUrl: managedSession.rtspUrl
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
      reason: 'no active sessions'
    });
  }

  private runSweep(): void {
    this.lastSweepAt = Date.now();

    for (const [streamId, managedSession] of this.sessions.entries()) {
      const snapshot = managedSession.session.getSnapshot();

      if (snapshot.clientCount === 0) {
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

      logger.warn('stream manager detected idle ffmpeg session, scheduling recovery', {
        streamId,
        idleForMs,
        idleTimeoutMs: this.idleTimeoutMs,
        lastDataAt: snapshot.lastDataAt,
        lastStartedAt: snapshot.lastStartedAt,
        restartCount: snapshot.restartCount
      });

      managedSession.session.restart(`idle timeout exceeded (${idleForMs}ms)`);
    }
  }
}

export const streamManager = new StreamManager();
