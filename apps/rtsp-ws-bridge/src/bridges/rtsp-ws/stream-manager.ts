import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';

import { env } from '../../config/env.js';
import type { FfmpegSessionSnapshot } from './ffmpeg-session.js';
import { UpstreamRegistry } from './upstream-registry.js';

export interface AttachClientInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
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
  private readonly upstreamRegistry: UpstreamRegistry;
  private readonly idleTimeoutMs: number;
  private readonly sweepIntervalMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;
  private lastSweepAt: number | null = null;

  constructor(options?: {
    idleTimeoutMs?: number;
    sweepIntervalMs?: number;
    upstreamRegistry?: UpstreamRegistry;
  }) {
    this.idleTimeoutMs = normalizeNumber(options?.idleTimeoutMs, DEFAULT_IDLE_TIMEOUT_MS);
    this.sweepIntervalMs = normalizeNumber(options?.sweepIntervalMs, DEFAULT_SWEEP_INTERVAL_MS);
    this.upstreamRegistry =
      options?.upstreamRegistry ??
      new UpstreamRegistry({
        rtspUrlTemplate: DEFAULT_RTSP_URL_TEMPLATE
      });
  }

  attachClient(input: AttachClientInput): void {
    const { streamId, ws, clientIp, rtspUrl } = input;

    const managedUpstream = this.upstreamRegistry.getOrCreate({
      streamId,
      rtspUrl
    });

    const snapshotBeforeAttach = managedUpstream.session.getSnapshot();

    managedUpstream.session.attachClient({
      ws,
      clientIp
    });

    const snapshotAfterAttach = managedUpstream.session.getSnapshot();

    logger.info('stream websocket client connected', {
      streamId,
      upstreamKey: managedUpstream.upstreamKey,
      sessionId: snapshotAfterAttach.sessionId,
      pid: snapshotAfterAttach.pid,
      reason: 'ws_connect',
      clientIp,
      clientCount: snapshotAfterAttach.clientCount
    });

    if (snapshotBeforeAttach.clientCount === 0) {
      managedUpstream.session.start();
    }

    this.ensureSweepStarted();

    try {
      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          upstreamKey: managedUpstream.upstreamKey,
          message: 'live websocket connected',
          rtspUrlSource: rtspUrl ? 'query' : DEFAULT_RTSP_URL_TEMPLATE ? 'template' : 'unknown',
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      const snapshot = managedUpstream.session.getSnapshot();

      logger.error('stream websocket initial response failed', {
        streamId,
        upstreamKey: managedUpstream.upstreamKey,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: 'ws_init_send_failed',
        clientIp,
        error
      });

      managedUpstream.session.detachClient(ws, 'initial message send failed');
      this.upstreamRegistry.releaseIfUnused(managedUpstream.upstreamKey, 'initial_send_failed');
      this.maybeStopSweep();

      throw error;
    }

    const cleanupForSocket = (reason: string) => {
      managedUpstream.session.detachClient(ws, reason);
      this.upstreamRegistry.releaseIfUnused(managedUpstream.upstreamKey, reason);
      this.maybeStopSweep();
    };

    ws.on('close', (code, reason) => {
      cleanupForSocket(`websocket close (${code}: ${reason.toString()})`);
    });

    ws.on('error', (error) => {
      const snapshot = managedUpstream.session.getSnapshot();

      logger.error('stream websocket client error', {
        streamId,
        upstreamKey: managedUpstream.upstreamKey,
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

      const snapshot = managedUpstream.session.getSnapshot();

      logger.info('stream websocket client message received', {
        streamId,
        upstreamKey: managedUpstream.upstreamKey,
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
          upstreamKey: managedUpstream.upstreamKey,
          message: 'live route does not accept upstream control messages yet',
          timestamp: new Date().toISOString()
        })
      );
    });
  }

  getActiveSessionCount(): number {
    return this.upstreamRegistry.getActiveUpstreamCount();
  }

  getSessionSnapshot(streamId: string): FfmpegSessionSnapshot | null {
    return this.upstreamRegistry.getSessionSnapshotByStreamId(streamId);
  }

  getAllSessionSnapshots(): FfmpegSessionSnapshot[] {
    return this.upstreamRegistry.list().map((upstream) => upstream.session.getSnapshot());
  }

  getRuntimeStats(): {
    activeSessionCount: number;
    activeUpstreamCount: number;
    idleTimeoutMs: number;
    sweepIntervalMs: number;
    lastSweepAt: number | null;
  } {
    const activeUpstreamCount = this.upstreamRegistry.getActiveUpstreamCount();

    return {
      activeSessionCount: activeUpstreamCount,
      activeUpstreamCount,
      idleTimeoutMs: this.idleTimeoutMs,
      sweepIntervalMs: this.sweepIntervalMs,
      lastSweepAt: this.lastSweepAt
    };
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
      upstreamKey: null,
      sessionId: null,
      pid: null,
      reason: 'sweep_loop_start',
      sweepIntervalMs: this.sweepIntervalMs,
      idleTimeoutMs: this.idleTimeoutMs
    });
  }

  private maybeStopSweep(): void {
    if (this.upstreamRegistry.getActiveUpstreamCount() > 0 || !this.sweepTimer) {
      return;
    }

    clearInterval(this.sweepTimer);
    this.sweepTimer = null;

    logger.info('stream manager stopped idle sweep loop', {
      streamId: null,
      upstreamKey: null,
      sessionId: null,
      pid: null,
      reason: 'sweep_loop_stop'
    });
  }

  private runSweep(): void {
    this.lastSweepAt = Date.now();

    for (const managedUpstream of this.upstreamRegistry.list()) {
      const snapshot = managedUpstream.session.getSnapshot();

      if (snapshot.clientCount === 0) {
        this.upstreamRegistry.releaseIfUnused(managedUpstream.upstreamKey, 'sweep_no_clients');
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
        streamId: managedUpstream.streamId,
        upstreamKey: managedUpstream.upstreamKey,
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

      managedUpstream.session.restart(`idle timeout exceeded (${idleForMs}ms)`);
    }

    this.maybeStopSweep();
  }
}

export const streamManager = new StreamManager();
