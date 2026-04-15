import test from 'node:test';
import assert from 'node:assert/strict';
import type { WebSocket } from 'ws';

import {
  UpstreamRegistry,
  type RegistrySession
} from '../src/bridges/rtsp-ws/upstream-registry.js';

type FakeState = 'idle' | 'running' | 'stopped';

class FakeSession implements RegistrySession {
  private clientCount = 0;
  private state: FakeState = 'idle';
  private readonly sessionId: string;
  private readonly streamId: string;
  private readonly rtspUrl: string;
  private lastStartedAt: number | null = null;
  private lastDataAt: number | null = null;
  private lastErrorAt: number | null = null;

  public startCalls = 0;
  public stopCalls = 0;
  public restartCalls = 0;

  constructor(input: { streamId: string; rtspUrl: string; sessionId: string }) {
    this.streamId = input.streamId;
    this.rtspUrl = input.rtspUrl;
    this.sessionId = input.sessionId;
  }

  attachClient(): void {
    this.clientCount += 1;
  }

  detachClient(): void {
    this.clientCount = Math.max(0, this.clientCount - 1);
  }

  start(): void {
    this.startCalls += 1;
    this.state = 'running';
    this.lastStartedAt = Date.now();
  }

  stop(): void {
    this.stopCalls += 1;
    this.state = 'stopped';
  }

  restart(): void {
    this.restartCalls += 1;
    this.state = 'running';
    this.lastStartedAt = Date.now();
  }

  getSnapshot() {
    return {
      sessionId: this.sessionId,
      streamId: this.streamId,
      rtspUrl: this.rtspUrl,
      pid: null,
      state: this.state,
      clientCount: this.clientCount,
      lastStartedAt: this.lastStartedAt,
      lastDataAt: this.lastDataAt,
      restartCount: this.restartCalls,
      lastErrorAt: this.lastErrorAt
    };
  }
}

test('same upstream key reuses one session', () => {
  let createdCount = 0;

  const registry = new UpstreamRegistry({
    rtspUrlTemplate: 'rtsp://example.local/live/{id}',
    createSession: ({ streamId, rtspUrl }) => {
      createdCount += 1;
      return new FakeSession({
        streamId,
        rtspUrl,
        sessionId: `session-${createdCount}`
      });
    }
  });

  const a = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'RTSP://EXAMPLE.LOCAL/live/camera-01/'
  });

  const b = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  assert.equal(createdCount, 1);
  assert.equal(a.upstreamKey, b.upstreamKey);
  assert.equal(a.session, b.session);
  assert.equal(registry.getActiveUpstreamCount(), 1);
});

test('different upstream keys create different sessions', () => {
  let createdCount = 0;

  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) => {
      createdCount += 1;
      return new FakeSession({
        streamId,
        rtspUrl,
        sessionId: `session-${createdCount}`
      });
    }
  });

  const a = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  const b = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-02'
  });

  assert.notEqual(a.upstreamKey, b.upstreamKey);
  assert.notEqual(a.session, b.session);
  assert.equal(createdCount, 2);
  assert.equal(registry.getActiveUpstreamCount(), 2);
});

test('releaseIfUnused does not destroy upstream with active clients', () => {
  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) =>
      new FakeSession({
        streamId,
        rtspUrl,
        sessionId: 'session-1'
      })
  });

  const upstream = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  upstream.session.attachClient({
    ws: {} as WebSocket,
    clientIp: '127.0.0.1'
  });

  registry.releaseIfUnused(upstream.upstreamKey, 'test');

  assert.equal(registry.getActiveUpstreamCount(), 1);
  assert.equal(upstream.session.getSnapshot().clientCount, 1);
});

test('releaseIfUnused destroys upstream when no clients remain', () => {
  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) =>
      new FakeSession({
        streamId,
        rtspUrl,
        sessionId: 'session-1'
      })
  });

  const upstream = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  upstream.session.attachClient({
    ws: {} as WebSocket,
    clientIp: '127.0.0.1'
  });

  upstream.session.detachClient({} as WebSocket, 'test disconnect');
  registry.releaseIfUnused(upstream.upstreamKey, 'test');

  assert.equal(registry.getActiveUpstreamCount(), 0);
  assert.equal(registry.get(upstream.upstreamKey), null);
});

test('getRuntimeStats returns active upstream count and total client count', () => {
  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) =>
      new FakeSession({
        streamId,
        rtspUrl,
        sessionId: `session-${streamId}`
      })
  });

  const upstreamA = registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  const upstreamB = registry.getOrCreate({
    streamId: 'camera-02',
    rtspUrl: 'rtsp://example.local/live/camera-02'
  });

  upstreamA.session.attachClient({
    ws: {} as WebSocket,
    clientIp: '127.0.0.1'
  });
  upstreamA.session.attachClient({
    ws: {} as WebSocket,
    clientIp: '127.0.0.1'
  });
  upstreamB.session.attachClient({
    ws: {} as WebSocket,
    clientIp: '127.0.0.1'
  });

  const stats = registry.getRuntimeStats();

  assert.equal(stats.activeUpstreamCount, 2);
  assert.equal(stats.totalClientCount, 3);
  assert.equal(stats.upstreams.length, 2);

  const first = stats.upstreams.find((item) => item.streamId === 'camera-01');
  assert.ok(first);
  assert.equal(first?.clientCount, 2);
  assert.equal(first?.rtspUrl, 'rtsp://example.local/live/camera-01');
});

test('getSessionSnapshotByStreamId returns snapshot of active upstream', () => {
  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) =>
      new FakeSession({
        streamId,
        rtspUrl,
        sessionId: 'session-1'
      })
  });

  registry.getOrCreate({
    streamId: 'camera-01',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  const snapshot = registry.getSessionSnapshotByStreamId('camera-01');

  assert.ok(snapshot);
  assert.equal(snapshot?.streamId, 'camera-01');
  assert.equal(snapshot?.rtspUrl, 'rtsp://example.local/live/camera-01');
});
