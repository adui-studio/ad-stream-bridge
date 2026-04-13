import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

import { StreamManager } from '../src/bridges/rtsp-ws/stream-manager.js';
import { FfmpegSession } from '../src/bridges/rtsp-ws/ffmpeg-session.js';
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

function patchSessionLifecycle(t: Parameters<typeof test>[1]) {
  const originalStart = FfmpegSession.prototype.start;
  const originalStop = FfmpegSession.prototype.stop;
  const originalRestart = FfmpegSession.prototype.restart;

  const startCalls: Array<{ streamId: string }> = [];
  const stopCalls: Array<{ streamId: string; reason: string }> = [];
  const restartCalls: Array<{ streamId: string; reason: string }> = [];

  FfmpegSession.prototype.start = function patchedStart(this: FfmpegSession): void {
    const self = this as unknown as {
      state: string;
      lastStartedAt: number | null;
      getSnapshot: () => { streamId: string };
    };

    startCalls.push({
      streamId: self.getSnapshot().streamId
    });

    self.state = 'running';
    self.lastStartedAt = Date.now();
  };

  FfmpegSession.prototype.stop = function patchedStop(
    this: FfmpegSession,
    reason = 'manual stop'
  ): void {
    const self = this as unknown as {
      state: string;
      lastStoppedAt: number | null;
      shouldRestart: boolean;
      getSnapshot: () => { streamId: string };
      clearAllClientBindings?: () => void;
    };

    stopCalls.push({
      streamId: self.getSnapshot().streamId,
      reason
    });

    self.shouldRestart = false;
    self.state = 'stopped';
    self.lastStoppedAt = Date.now();

    if (typeof self.clearAllClientBindings === 'function') {
      self.clearAllClientBindings();
    }
  };

  FfmpegSession.prototype.restart = function patchedRestart(
    this: FfmpegSession,
    reason = 'manual restart'
  ): void {
    const self = this as unknown as {
      state: string;
      restartCount: number;
      lastRestartAt: number | null;
      lastStartedAt: number | null;
      getSnapshot: () => { streamId: string };
    };

    restartCalls.push({
      streamId: self.getSnapshot().streamId,
      reason
    });

    self.restartCount += 1;
    self.lastRestartAt = Date.now();
    self.lastStartedAt = Date.now();
    self.state = 'running';
  };

  t.after(() => {
    FfmpegSession.prototype.start = originalStart;
    FfmpegSession.prototype.stop = originalStop;
    FfmpegSession.prototype.restart = originalRestart;
  });

  return {
    startCalls,
    stopCalls,
    restartCalls
  };
}

test('idle timeout triggers restart for running session with active clients', async (t) => {
  const { startCalls, restartCalls, stopCalls } = patchSessionLifecycle(t);

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20
  });

  const ws = new MockWebSocket();

  manager.attachClient({
    streamId: 'camera-idle-01',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-01'
  });

  assert.equal(startCalls.length, 1);
  assert.equal(restartCalls.length, 0);

  await waitFor(() => restartCalls.length >= 1, {
    message: 'expected idle sweep to trigger recovery restart'
  });

  const snapshot = manager.getSessionSnapshot('camera-idle-01');

  assert.ok(snapshot);
  assert.equal(snapshot.clientCount, 1);
  assert.equal(snapshot.state, 'running');
  assert.equal(stopCalls.length, 0);
  assert.equal(restartCalls[0]?.streamId, 'camera-idle-01');
  assert.match(restartCalls[0]?.reason ?? '', /idle timeout exceeded/);

  ws.close(1000, 'cleanup');
});

test('idle sweep destroys session with no clients instead of restarting it', async (t) => {
  const { startCalls, restartCalls, stopCalls } = patchSessionLifecycle(t);

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20
  });

  const ws = new MockWebSocket();

  manager.attachClient({
    streamId: 'camera-idle-02',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-02'
  });

  assert.equal(startCalls.length, 1);
  assert.equal(manager.getActiveSessionCount(), 1);

  ws.close(1000, 'client closed');

  await waitFor(() => manager.getSessionSnapshot('camera-idle-02') === null, {
    message: 'expected session to be destroyed after last client disconnect'
  });

  assert.equal(manager.getActiveSessionCount(), 0);
  assert.equal(restartCalls.length, 0);
  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0]?.streamId, 'camera-idle-02');
  assert.equal(stopCalls[0]?.reason, 'no websocket clients remain');
});

test('idle timeout does not trigger restart when session is not running', async (t) => {
  const { startCalls, restartCalls, stopCalls } = patchSessionLifecycle(t);

  const manager = new StreamManager({
    idleTimeoutMs: 80,
    sweepIntervalMs: 20
  });

  const ws = new MockWebSocket();

  manager.attachClient({
    streamId: 'camera-idle-03',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-idle-03'
  });

  assert.equal(startCalls.length, 1);

  const snapshot = manager.getSessionSnapshot('camera-idle-03');
  assert.ok(snapshot);

  const sessionRecord = (
    manager as unknown as {
      sessions: Map<string, { session: unknown }>;
    }
  ).sessions.get('camera-idle-03');

  assert.ok(sessionRecord);

  const session = sessionRecord.session as {
    state: string;
    lastStartedAt: number | null;
    lastDataAt: number | null;
  };

  session.state = 'starting';
  session.lastStartedAt = Date.now() - 1000;
  session.lastDataAt = null;

  await delay(250);

  assert.equal(restartCalls.length, 0);
  assert.equal(stopCalls.length, 0);

  ws.close(1000, 'cleanup');
});
