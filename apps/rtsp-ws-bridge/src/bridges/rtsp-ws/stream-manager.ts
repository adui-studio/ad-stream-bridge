import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';

import { env } from '../../config/env.js';
import type { FfmpegSessionSnapshot } from './ffmpeg-session.js';
import { UpstreamRegistry } from './upstream-registry.js';

export interface OpenConnectionInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
}

export interface OpenConnectionResult {
  streamId: string;
  upstreamKey: string;
  rtspUrl: string;
  rtspUrlSource: 'query' | 'template' | 'unknown';
  sessionSnapshot: FfmpegSessionSnapshot;
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

  openConnection(input: OpenConnectionInput): OpenConnectionResult {
    const { streamId, ws, clientIp, rtspUrl } = input;

    const upstream = this.upstreamRegistry.getOrCreate({
      streamId,
      rtspUrl
    });

    const snapshotBeforeAttach = upstream.session.getSnapshot();

    upstream.session.attachClient({
      ws,
      clientIp
    });

    const snapshotAfterAttach = upstream.session.getSnapshot();

    logger.info('stream websocket client connected', {
      streamId,
      upstreamKey: upstream.upstreamKey,
      sessionId: snapshotAfterAttach.sessionId,
      pid: snapshotAfterAttach.pid,
      reason: 'ws_connect',
      clientIp,
      clientCount: snapshotAfterAttach.clientCount
    });

    if (snapshotBeforeAttach.clientCount === 0) {
      upstream.session.start();
    }

    this.ensureSweepStarted();

    return {
      streamId,
      upstreamKey: upstream.upstreamKey,
      rtspUrl: upstream.rtspUrl,
      rtspUrlSource: rtspUrl ? 'query' : DEFAULT_RTSP_URL_TEMPLATE ? 'template' : 'unknown',
      sessionSnapshot: upstream.session.getSnapshot()
    };
  }

  closeConnection(input: {
    streamId: string;
    upstreamKey: string;
    ws: WebSocket;
    reason: string;
  }): void {
    const upstream = this.upstreamRegistry.get(input.upstreamKey);

    if (!upstream) {
      return;
    }

    upstream.session.detachClient(input.ws, input.reason);
    this.upstreamRegistry.releaseIfUnused(input.upstreamKey, input.reason);
    this.maybeStopSweep();
  }

  handleClientMessage(input: {
    streamId: string;
    upstreamKey: string;
    clientIp: string;
    ws: WebSocket;
    payload: string;
  }): void {
    const upstream = this.upstreamRegistry.get(input.upstreamKey);
    const snapshot = upstream?.session.getSnapshot();

    logger.info('stream websocket client message received', {
      streamId: input.streamId,
      upstreamKey: input.upstreamKey,
      sessionId: snapshot?.sessionId ?? null,
      pid: snapshot?.pid ?? null,
      reason: 'ws_message',
      clientIp: input.clientIp,
      payload: input.payload
    });

    input.ws.send(
      JSON.stringify({
        ok: true,
        streamId: input.streamId,
        upstreamKey: input.upstreamKey,
        message: 'live route does not accept upstream control messages yet',
        timestamp: new Date().toISOString()
      })
    );
  }

  reportClientError(input: {
    streamId: string;
    upstreamKey: string;
    clientIp: string;
    error: unknown;
  }): void {
    const upstream = this.upstreamRegistry.get(input.upstreamKey);
    const snapshot = upstream?.session.getSnapshot();

    logger.error('stream websocket client error', {
      streamId: input.streamId,
      upstreamKey: input.upstreamKey,
      sessionId: snapshot?.sessionId ?? null,
      pid: snapshot?.pid ?? null,
      reason: 'ws_error',
      clientIp: input.clientIp,
      error: input.error
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
    totalClientCount: number;
    idleTimeoutMs: number;
    sweepIntervalMs: number;
    lastSweepAt: number | null;
    upstreams: Array<{
      streamId: string;
      upstreamKey: string;
      rtspUrl: string;
      createdAt: number;
      clientCount: number;
      state: FfmpegSessionSnapshot['state'];
      pid: number | null;
      restartCount: number;
      lastStartedAt: number | null;
      lastDataAt: number | null;
      lastErrorAt: number | null;
      snapshot: FfmpegSessionSnapshot;
    }>;
  } {
    const registryStats = this.upstreamRegistry.getRuntimeStats();

    return {
      activeSessionCount: registryStats.activeUpstreamCount,
      activeUpstreamCount: registryStats.activeUpstreamCount,
      totalClientCount: registryStats.totalClientCount,
      idleTimeoutMs: this.idleTimeoutMs,
      sweepIntervalMs: this.sweepIntervalMs,
      lastSweepAt: this.lastSweepAt,
      upstreams: registryStats.upstreams
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

    for (const upstream of this.upstreamRegistry.list()) {
      const snapshot = upstream.session.getSnapshot();

      if (snapshot.clientCount === 0) {
        this.upstreamRegistry.releaseIfUnused(upstream.upstreamKey, 'sweep_no_clients');
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
        streamId: upstream.streamId,
        upstreamKey: upstream.upstreamKey,
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

      upstream.session.restart(`idle timeout exceeded (${idleForMs}ms)`);
    }

    this.maybeStopSweep();
  }
}

export const streamManager = new StreamManager();
