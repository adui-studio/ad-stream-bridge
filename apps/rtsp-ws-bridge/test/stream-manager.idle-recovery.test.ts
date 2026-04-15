import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { WebSocket } from 'ws';

import { StreamManager } from '../src/bridges/rtsp-ws/stream-manager.js';
import {
  UpstreamRegistry,
  type RegistrySession
} from '../src/bridges/rtsp-ws/upstream-registry.js';
import { MockWebSocket } from './helpers/mock-websocket.js';

const WAIT_STEP_MS = 25;
const WAIT_TIMEOUT_MS = 3000;

async function waitFor(
  predicate: () => boolean,
  options?: { timeoutMs?: number; stepMs?: number; message?: string }
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? WAIT_TIMEOUT_MS;
  const stepMs = options?.stepMs ?? WAIT_STEP_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await delay(stepMs);
  }

  assert.fail(options?.message ?? 'waitFor timeout');
}

class FakeSession implements RegistrySession {
  public clientCount = 0;
  public state: 'idle' | 'starting' | 'running' | 'stopped' = 'idle';
  public lastStartedAt: number | null = null;
  public lastDataAt: number | null = null;
  public restartCount = 0;
  public lastErrorAt: number | null = null;

  constructor(
    private readonly streamId: string,
    private readonly rtspUrl: string
  ) {}

  attachClient(_input: { ws: WebSocket; clientIp: string }): void {
    this.clientCount += 1;
  }

  detachClient(_ws: WebSocket, _reason?: string): void {
    this.clientCount = Math.max(0, this.clientCount - 1);
  }

  start(): void {
    this.state = 'running';
    this.lastStartedAt = Date.now();
  }

  stop(): void {
    this.state = 'stopped';
  }

  restart(): void {
    this.restartCount += 1;
    this.state = 'running';
    this.lastStartedAt = Date.now();
  }

  getSnapshot() {
    return {
      sessionId: `session:${this.streamId}`,
      streamId: this.streamId,
      rtspUrl: this.rtspUrl,
      pid: null,
      state: this.state,
      clientCount: this.clientCount,
      lastStartedAt: this.lastStartedAt,
      lastDataAt: this.lastDataAt,
      restartCount: this.restartCount,
      lastErrorAt: this.lastErrorAt
    };
  }
}

test('idle timeout triggers restart for running session with active clients', async () => {
  let fakeSession: FakeSession | null = null;

  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) => {
      fakeSession = new FakeSession(streamId, rtspUrl);
      return fakeSession;
    }
  });

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20,
    upstreamRegistry: registry
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-idle-01',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-01'
  });

  assert.ok(fakeSession);
  assert.equal(fakeSession.restartCount, 0);

  fakeSession.lastStartedAt = Date.now() - 1000;
  fakeSession.lastDataAt = null;
  fakeSession.state = 'running';

  await waitFor(() => (fakeSession?.restartCount ?? 0) >= 1, {
    message: 'expected idle sweep to trigger recovery restart'
  });

  const snapshot = manager.getSessionSnapshot('camera-idle-01');

  assert.ok(snapshot);
  assert.equal(snapshot.clientCount, 1);
  assert.equal(snapshot.state, 'running');
  assert.equal(fakeSession?.restartCount, 1);

  manager.closeConnection({
    streamId: 'camera-idle-01',
    upstreamKey: opened.upstreamKey,
    ws: ws as never,
    reason: 'cleanup'
  });

  await waitFor(() => manager.getActiveSessionCount() === 0, {
    message: 'expected cleanup to stop active upstream'
  });
});

test('idle sweep destroys session with no clients instead of restarting it', async () => {
  let fakeSession: FakeSession | null = null;

  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) => {
      fakeSession = new FakeSession(streamId, rtspUrl);
      return fakeSession;
    }
  });

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20,
    upstreamRegistry: registry
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-idle-02',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-02'
  });

  assert.ok(fakeSession);
  assert.equal(manager.getActiveSessionCount(), 1);

  manager.closeConnection({
    streamId: 'camera-idle-02',
    upstreamKey: opened.upstreamKey,
    ws: ws as never,
    reason: 'client closed'
  });

  await waitFor(() => manager.getSessionSnapshot('camera-idle-02') === null, {
    message: 'expected session to be destroyed after last client disconnect'
  });

  assert.equal(manager.getActiveSessionCount(), 0);
  assert.equal(fakeSession?.restartCount, 0);
});

test('idle timeout does not trigger restart when session is not running', async () => {
  let fakeSession: FakeSession | null = null;

  const registry = new UpstreamRegistry({
    createSession: ({ streamId, rtspUrl }) => {
      fakeSession = new FakeSession(streamId, rtspUrl);
      return fakeSession;
    }
  });

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20,
    upstreamRegistry: registry
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-idle-03',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-03'
  });

  assert.ok(fakeSession);

  fakeSession.state = 'starting';
  fakeSession.lastStartedAt = Date.now() - 1000;
  fakeSession.lastDataAt = null;

  await delay(250);

  assert.equal(fakeSession.restartCount, 0);
  assert.equal(fakeSession.state, 'starting');

  manager.closeConnection({
    streamId: 'camera-idle-03',
    upstreamKey: opened.upstreamKey,
    ws: ws as never,
    reason: 'cleanup'
  });

  await waitFor(() => manager.getActiveSessionCount() === 0, {
    message: 'expected cleanup to stop active upstream'
  });
});
