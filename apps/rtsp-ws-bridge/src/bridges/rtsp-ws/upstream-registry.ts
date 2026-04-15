import { logger } from '@adui/logger';
import type { WebSocket } from 'ws';
import { FfmpegSession, type FfmpegSessionSnapshot } from './ffmpeg-session.js';
import { resolveUpstreamDescriptor } from './upstream-key.js';

export interface ManagedUpstream {
  streamId: string;
  upstreamKey: string;
  rtspUrl: string;
  createdAt: number;
  session: RegistrySession;
}

export interface RegistrySession {
  attachClient(input: { ws: WebSocket; clientIp: string }): void;
  detachClient(ws: WebSocket, reason?: string): void;
  start(): void;
  stop(reason?: string): void;
  restart(reason?: string): void;
  getSnapshot(): FfmpegSessionSnapshot;
}

export interface UpstreamRuntimeEntry {
  streamId: string;
  upstreamKey: string;
  rtspUrl: string;
  createdAt: number;
  snapshot: FfmpegSessionSnapshot;
}

export interface UpstreamRegistryRuntimeStats {
  activeUpstreamCount: number;
  upstreams: UpstreamRuntimeEntry[];
}

export interface UpstreamRegistryOptions {
  rtspUrlTemplate?: string;
  createSession?: (input: { streamId: string; rtspUrl: string }) => RegistrySession;
}

export class UpstreamRegistry {
  private readonly upstreams = new Map<string, ManagedUpstream>();
  private readonly rtspUrlTemplate?: string;
  private readonly createSession: (input: { streamId: string; rtspUrl: string }) => RegistrySession;

  constructor(options?: UpstreamRegistryOptions) {
    this.rtspUrlTemplate = options?.rtspUrlTemplate;
    this.createSession =
      options?.createSession ??
      ((input) =>
        new FfmpegSession({
          streamId: input.streamId,
          rtspUrl: input.rtspUrl
        }));
  }

  getOrCreate(input: { streamId: string; rtspUrl?: string }): ManagedUpstream {
    const upstream = resolveUpstreamDescriptor({
      streamId: input.streamId,
      directRtspUrl: input.rtspUrl,
      rtspUrlTemplate: this.rtspUrlTemplate
    });

    const existing = this.upstreams.get(upstream.upstreamKey);
    if (existing) {
      return existing;
    }

    const session = this.createSession({
      streamId: input.streamId,
      rtspUrl: upstream.resolvedRtspUrl
    });

    const managedUpstream: ManagedUpstream = {
      streamId: input.streamId,
      upstreamKey: upstream.upstreamKey,
      rtspUrl: upstream.resolvedRtspUrl,
      createdAt: Date.now(),
      session
    };

    this.upstreams.set(upstream.upstreamKey, managedUpstream);

    logger.info('stream upstream created', {
      streamId: managedUpstream.streamId,
      upstreamKey: managedUpstream.upstreamKey,
      sessionId: session.getSnapshot().sessionId,
      pid: null,
      reason: 'upstream_create',
      rtspUrl: managedUpstream.rtspUrl
    });

    return managedUpstream;
  }

  get(upstreamKey: string): ManagedUpstream | null {
    return this.upstreams.get(upstreamKey) ?? null;
  }

  getByStreamId(streamId: string): ManagedUpstream | null {
    for (const upstream of this.upstreams.values()) {
      if (upstream.streamId === streamId) {
        return upstream;
      }
    }
    return null;
  }

  getSessionSnapshotByStreamId(streamId: string): FfmpegSessionSnapshot | null {
    return this.getByStreamId(streamId)?.session.getSnapshot() ?? null;
  }

  list(): ManagedUpstream[] {
    return Array.from(this.upstreams.values());
  }

  getActiveUpstreamCount(): number {
    return this.upstreams.size;
  }

  getRuntimeStats(): UpstreamRegistryRuntimeStats {
    return {
      activeUpstreamCount: this.upstreams.size,
      upstreams: this.list().map((upstream) => ({
        streamId: upstream.streamId,
        upstreamKey: upstream.upstreamKey,
        rtspUrl: upstream.rtspUrl,
        createdAt: upstream.createdAt,
        snapshot: upstream.session.getSnapshot()
      }))
    };
  }

  releaseIfUnused(upstreamKey: string, triggerReason = 'idle_cleanup'): void {
    const managedUpstream = this.upstreams.get(upstreamKey);
    if (!managedUpstream) {
      return;
    }

    const snapshot = managedUpstream.session.getSnapshot();
    if (snapshot.clientCount > 0) {
      logger.debug?.('stream upstream cleanup skipped: clients still attached', {
        streamId: managedUpstream.streamId,
        upstreamKey,
        sessionId: snapshot.sessionId,
        pid: snapshot.pid,
        reason: triggerReason,
        clientCount: snapshot.clientCount,
        state: snapshot.state
      });
      return;
    }

    managedUpstream.session.stop('no websocket clients remain');
    this.upstreams.delete(upstreamKey);

    logger.info('stream upstream destroyed', {
      streamId: managedUpstream.streamId,
      upstreamKey,
      sessionId: snapshot.sessionId,
      pid: snapshot.pid,
      reason: triggerReason,
      rtspUrl: managedUpstream.rtspUrl,
      createdAt: managedUpstream.createdAt
    });
  }
}
