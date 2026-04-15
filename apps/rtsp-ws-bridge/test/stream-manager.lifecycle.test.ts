import test from 'node:test';
import assert from 'node:assert/strict';

import { StreamManager } from '../src/bridges/rtsp-ws/stream-manager.js';
import { FfmpegSession } from '../src/bridges/rtsp-ws/ffmpeg-session.js';
import { MockWebSocket } from './helpers/mock-websocket.js';

function patchSessionLifecycle(t: Parameters<typeof test>[1]) {
  const originalStart = FfmpegSession.prototype.start;
  const originalStop = FfmpegSession.prototype.stop;

  const startCalls: Array<{ streamId: string }> = [];
  const stopCalls: Array<{ streamId: string; reason: string }> = [];

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

  t.after(() => {
    FfmpegSession.prototype.start = originalStart;
    FfmpegSession.prototype.stop = originalStop;
  });

  return {
    startCalls,
    stopCalls
  };
}

test('first client open creates session and starts ffmpeg lifecycle', (t) => {
  const { startCalls, stopCalls } = patchSessionLifecycle(t);
  const manager = new StreamManager({
    sweepIntervalMs: 0,
    idleTimeoutMs: 60_000
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-01',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-01'
  });

  assert.equal(manager.getActiveSessionCount(), 1);
  assert.equal(startCalls.length, 1);
  assert.equal(stopCalls.length, 0);

  const snapshot = manager.getSessionSnapshot('camera-01');

  assert.ok(snapshot);
  assert.equal(snapshot.clientCount, 1);
  assert.equal(snapshot.streamId, 'camera-01');

  assert.equal(opened.streamId, 'camera-01');
  assert.equal(opened.upstreamKey, 'rtsp://example.local/live/camera-01');
  assert.equal(opened.rtspUrlSource, 'query');
});

test('second client on the same upstream reuses session and does not start twice', (t) => {
  const { startCalls, stopCalls } = patchSessionLifecycle(t);
  const manager = new StreamManager({
    sweepIntervalMs: 0,
    idleTimeoutMs: 60_000
  });

  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();

  const opened1 = manager.openConnection({
    streamId: 'camera-02',
    ws: ws1 as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-02'
  });

  const opened2 = manager.openConnection({
    streamId: 'camera-02',
    ws: ws2 as never,
    clientIp: '127.0.0.2',
    rtspUrl: 'RTSP://EXAMPLE.LOCAL/live/camera-02/'
  });

  assert.equal(manager.getActiveSessionCount(), 1);
  assert.equal(startCalls.length, 1);
  assert.equal(stopCalls.length, 0);

  const snapshot = manager.getSessionSnapshot('camera-02');

  assert.ok(snapshot);
  assert.equal(snapshot.clientCount, 2);
  assert.equal(opened1.upstreamKey, opened2.upstreamKey);

  manager.closeConnection({
    streamId: 'camera-02',
    upstreamKey: opened1.upstreamKey,
    ws: ws1 as never,
    reason: 'first client closed'
  });

  const snapshotAfterFirstClose = manager.getSessionSnapshot('camera-02');

  assert.ok(snapshotAfterFirstClose);
  assert.equal(snapshotAfterFirstClose.clientCount, 1);
  assert.equal(manager.getActiveSessionCount(), 1);
  assert.equal(stopCalls.length, 0);

  manager.closeConnection({
    streamId: 'camera-02',
    upstreamKey: opened2.upstreamKey,
    ws: ws2 as never,
    reason: 'second client closed'
  });

  assert.equal(manager.getActiveSessionCount(), 0);
  assert.equal(manager.getSessionSnapshot('camera-02'), null);
  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0]?.streamId, 'camera-02');
  assert.equal(stopCalls[0]?.reason, 'no websocket clients remain');
});

test('last client close stops and destroys the managed session', (t) => {
  const { startCalls, stopCalls } = patchSessionLifecycle(t);
  const manager = new StreamManager({
    sweepIntervalMs: 0,
    idleTimeoutMs: 60_000
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-03',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-03'
  });

  assert.equal(startCalls.length, 1);
  assert.equal(manager.getActiveSessionCount(), 1);

  manager.closeConnection({
    streamId: 'camera-03',
    upstreamKey: opened.upstreamKey,
    ws: ws as never,
    reason: 'client closed'
  });

  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0]?.streamId, 'camera-03');
  assert.equal(stopCalls[0]?.reason, 'no websocket clients remain');
  assert.equal(manager.getActiveSessionCount(), 0);
  assert.equal(manager.getSessionSnapshot('camera-03'), null);
});

test('websocket error path can report error and destroy idle session', (t) => {
  const { startCalls, stopCalls } = patchSessionLifecycle(t);
  const manager = new StreamManager({
    sweepIntervalMs: 0,
    idleTimeoutMs: 60_000
  });

  const ws = new MockWebSocket();

  const opened = manager.openConnection({
    streamId: 'camera-04',
    ws: ws as never,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-04'
  });

  assert.equal(startCalls.length, 1);
  assert.equal(manager.getActiveSessionCount(), 1);

  manager.reportClientError({
    streamId: 'camera-04',
    upstreamKey: opened.upstreamKey,
    clientIp: '127.0.0.1',
    error: new Error('socket failure')
  });

  manager.closeConnection({
    streamId: 'camera-04',
    upstreamKey: opened.upstreamKey,
    ws: ws as never,
    reason: 'websocket error'
  });

  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0]?.streamId, 'camera-04');
  assert.equal(stopCalls[0]?.reason, 'no websocket clients remain');
  assert.equal(manager.getActiveSessionCount(), 0);
  assert.equal(manager.getSessionSnapshot('camera-04'), null);
});
