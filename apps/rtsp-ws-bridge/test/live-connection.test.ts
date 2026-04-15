import test from 'node:test';
import assert from 'node:assert/strict';

import { bindLiveConnection } from '../src/bridges/rtsp-ws/live-connection.js';

class FakeWebSocket {
  public sent: string[] = [];
  public closed: Array<{ code?: number; reason?: string }> = [];
  private readonly handlers = new Map<string, Array<(...args: any[]) => void>>();

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(code?: number, reason?: string): void {
    this.closed.push({ code, reason });
  }

  on(event: string, handler: (...args: any[]) => void): void {
    const current = this.handlers.get(event) ?? [];
    current.push(handler);
    this.handlers.set(event, current);
  }

  emit(event: string, ...args: any[]): void {
    const current = this.handlers.get(event) ?? [];
    for (const handler of current) {
      handler(...args);
    }
  }
}

test('bindLiveConnection sends initial welcome message', () => {
  const ws = new FakeWebSocket();
  const calls: string[] = [];

  const manager = {
    openConnection: () => {
      calls.push('openConnection');
      return {
        streamId: 'camera-01',
        upstreamKey: 'rtsp://example.local/live/camera-01',
        rtspUrl: 'rtsp://example.local/live/camera-01',
        rtspUrlSource: 'query' as const,
        sessionSnapshot: {
          sessionId: 'session-1',
          streamId: 'camera-01',
          rtspUrl: 'rtsp://example.local/live/camera-01',
          pid: null,
          state: 'running',
          clientCount: 1,
          lastStartedAt: null,
          lastDataAt: null,
          restartCount: 0,
          lastErrorAt: null
        }
      };
    },
    closeConnection: () => {
      calls.push('closeConnection');
    },
    reportClientError: () => {
      calls.push('reportClientError');
    },
    handleClientMessage: () => {
      calls.push('handleClientMessage');
    }
  };

  bindLiveConnection({
    streamId: 'camera-01',
    ws: ws as any,
    clientIp: '127.0.0.1',
    rtspUrl: 'rtsp://example.local/live/camera-01',
    streamManager: manager as any
  });

  assert.equal(calls[0], 'openConnection');
  assert.equal(ws.sent.length, 1);

  const payload = JSON.parse(ws.sent[0] ?? '{}');
  assert.equal(payload.ok, true);
  assert.equal(payload.streamId, 'camera-01');
  assert.equal(payload.upstreamKey, 'rtsp://example.local/live/camera-01');
  assert.equal(payload.message, 'live websocket connected');
});

test('bindLiveConnection closes manager connection when websocket closes', () => {
  const ws = new FakeWebSocket();
  const closeCalls: Array<{ streamId: string; upstreamKey: string; reason: string }> = [];

  const manager = {
    openConnection: () => ({
      streamId: 'camera-01',
      upstreamKey: 'rtsp://example.local/live/camera-01',
      rtspUrl: 'rtsp://example.local/live/camera-01',
      rtspUrlSource: 'query' as const,
      sessionSnapshot: {
        sessionId: 'session-1',
        streamId: 'camera-01',
        rtspUrl: 'rtsp://example.local/live/camera-01',
        pid: null,
        state: 'running',
        clientCount: 1,
        lastStartedAt: null,
        lastDataAt: null,
        restartCount: 0,
        lastErrorAt: null
      }
    }),
    closeConnection: (input: { streamId: string; upstreamKey: string; reason: string }) => {
      closeCalls.push(input);
    },
    reportClientError: () => {},
    handleClientMessage: () => {}
  };

  bindLiveConnection({
    streamId: 'camera-01',
    ws: ws as any,
    clientIp: '127.0.0.1',
    streamManager: manager as any
  });

  ws.emit('close', 1000, Buffer.from('normal'));

  assert.equal(closeCalls.length, 1);
  assert.equal(closeCalls[0]?.streamId, 'camera-01');
  assert.equal(closeCalls[0]?.upstreamKey, 'rtsp://example.local/live/camera-01');
  assert.match(closeCalls[0]?.reason ?? '', /websocket close/);
});

test('bindLiveConnection reports websocket error and closes manager connection', () => {
  const ws = new FakeWebSocket();
  let reported = false;
  let closed = false;

  const manager = {
    openConnection: () => ({
      streamId: 'camera-01',
      upstreamKey: 'rtsp://example.local/live/camera-01',
      rtspUrl: 'rtsp://example.local/live/camera-01',
      rtspUrlSource: 'template' as const,
      sessionSnapshot: {
        sessionId: 'session-1',
        streamId: 'camera-01',
        rtspUrl: 'rtsp://example.local/live/camera-01',
        pid: null,
        state: 'running',
        clientCount: 1,
        lastStartedAt: null,
        lastDataAt: null,
        restartCount: 0,
        lastErrorAt: null
      }
    }),
    closeConnection: () => {
      closed = true;
    },
    reportClientError: () => {
      reported = true;
    },
    handleClientMessage: () => {}
  };

  bindLiveConnection({
    streamId: 'camera-01',
    ws: ws as any,
    clientIp: '127.0.0.1',
    streamManager: manager as any
  });

  ws.emit('error', new Error('boom'));

  assert.equal(reported, true);
  assert.equal(closed, true);
});

test('bindLiveConnection forwards websocket message to stream manager', () => {
  const ws = new FakeWebSocket();
  const payloads: string[] = [];

  const manager = {
    openConnection: () => ({
      streamId: 'camera-01',
      upstreamKey: 'rtsp://example.local/live/camera-01',
      rtspUrl: 'rtsp://example.local/live/camera-01',
      rtspUrlSource: 'query' as const,
      sessionSnapshot: {
        sessionId: 'session-1',
        streamId: 'camera-01',
        rtspUrl: 'rtsp://example.local/live/camera-01',
        pid: null,
        state: 'running',
        clientCount: 1,
        lastStartedAt: null,
        lastDataAt: null,
        restartCount: 0,
        lastErrorAt: null
      }
    }),
    closeConnection: () => {},
    reportClientError: () => {},
    handleClientMessage: (input: { payload: string }) => {
      payloads.push(input.payload);
    }
  };

  bindLiveConnection({
    streamId: 'camera-01',
    ws: ws as any,
    clientIp: '127.0.0.1',
    streamManager: manager as any
  });

  ws.emit('message', Buffer.from('hello'));
  ws.emit('message', 'world');

  assert.deepEqual(payloads, ['hello', 'world']);
});
