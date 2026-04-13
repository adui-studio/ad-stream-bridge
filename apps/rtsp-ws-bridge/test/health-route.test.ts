import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createApp } from '../src/app.js';
import { streamManager } from '../src/bridges/rtsp-ws/stream-manager.js';

interface HealthResponse {
  ok: boolean;
  service: string;
  status: string;
  timestamp: string;
  uptimeSec: number;
  runtime: {
    nodeVersion: string;
    platform: string;
    arch: string;
    pid: number;
    nodeEnv: string;
  };
  config: {
    host: string;
    port: number;
    logLevel: string;
    ffmpegPath: string;
    rtspUrlTemplate: string | null;
    streamRestartDelayMs: number;
    streamMaxRestarts: number;
    streamIdleTimeoutMs: number;
    streamSweepIntervalMs: number;
  };
  bridge: {
    activeSessionCount: number;
    idleTimeoutMs: number;
    sweepIntervalMs: number;
    lastSweepAt: number | null;
  };
  sessions: Array<{
    sessionId: string;
    streamId: string;
    rtspUrl: string;
    state: string;
    pid: number | null;
    clientCount: number;
    restartCount: number;
    lastRestartAt: number | null;
    lastStartedAt: number | null;
    lastStoppedAt: number | null;
    lastDataAt: number | null;
    lastErrorAt: number | null;
    lastExitCode: number | null;
    lastExitSignal: string | null;
  }>;
}

async function startTestServer(): Promise<{
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

function patchStreamManager(
  t: Parameters<typeof test>[1],
  options?: {
    sessions?: HealthResponse['sessions'];
    runtime?: HealthResponse['bridge'];
  }
) {
  const originalGetAllSessionSnapshots = streamManager.getAllSessionSnapshots.bind(streamManager);
  const originalGetRuntimeStats = streamManager.getRuntimeStats.bind(streamManager);

  streamManager.getAllSessionSnapshots = () => {
    return options?.sessions ?? [];
  };

  streamManager.getRuntimeStats = () => {
    return (
      options?.runtime ?? {
        activeSessionCount: 0,
        idleTimeoutMs: 15000,
        sweepIntervalMs: 10000,
        lastSweepAt: null
      }
    );
  };

  t.after(() => {
    streamManager.getAllSessionSnapshots = originalGetAllSessionSnapshots;
    streamManager.getRuntimeStats = originalGetRuntimeStats;
  });
}

test('GET /healthz returns the expected top-level structure', async (t) => {
  patchStreamManager(t, {
    sessions: [],
    runtime: {
      activeSessionCount: 0,
      idleTimeoutMs: 15000,
      sweepIntervalMs: 10000,
      lastSweepAt: null
    }
  });

  const { baseUrl, close } = await startTestServer();
  t.after(close);

  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as HealthResponse;

  assert.equal(body.ok, true);
  assert.equal(body.service, 'rtsp-ws-bridge');
  assert.equal(body.status, 'healthy');
  assert.equal(typeof body.timestamp, 'string');
  assert.equal(typeof body.uptimeSec, 'number');

  assert.ok(body.runtime);
  assert.equal(typeof body.runtime.nodeVersion, 'string');
  assert.equal(typeof body.runtime.platform, 'string');
  assert.equal(typeof body.runtime.arch, 'string');
  assert.equal(typeof body.runtime.pid, 'number');
  assert.equal(typeof body.runtime.nodeEnv, 'string');

  assert.ok(body.config);
  assert.equal(typeof body.config.host, 'string');
  assert.equal(typeof body.config.port, 'number');
  assert.equal(typeof body.config.logLevel, 'string');
  assert.equal(typeof body.config.ffmpegPath, 'string');
  assert.ok(
    body.config.rtspUrlTemplate === null || typeof body.config.rtspUrlTemplate === 'string'
  );
  assert.equal(typeof body.config.streamRestartDelayMs, 'number');
  assert.equal(typeof body.config.streamMaxRestarts, 'number');
  assert.equal(typeof body.config.streamIdleTimeoutMs, 'number');
  assert.equal(typeof body.config.streamSweepIntervalMs, 'number');

  assert.deepEqual(body.bridge, {
    activeSessionCount: 0,
    idleTimeoutMs: 15000,
    sweepIntervalMs: 10000,
    lastSweepAt: null
  });

  assert.deepEqual(body.sessions, []);
});

test('GET /healthz exposes streamManager runtime and session snapshots', async (t) => {
  const mockedSessions: HealthResponse['sessions'] = [
    {
      sessionId: 'session-01',
      streamId: 'camera-01',
      rtspUrl: 'rtsp://example.local/live/camera-01',
      state: 'running',
      pid: 4321,
      clientCount: 2,
      restartCount: 1,
      lastRestartAt: 1710000000000,
      lastStartedAt: 1710000001000,
      lastStoppedAt: null,
      lastDataAt: 1710000002000,
      lastErrorAt: null,
      lastExitCode: null,
      lastExitSignal: null
    }
  ];

  patchStreamManager(t, {
    sessions: mockedSessions,
    runtime: {
      activeSessionCount: 1,
      idleTimeoutMs: 20000,
      sweepIntervalMs: 5000,
      lastSweepAt: 1710000003000
    }
  });

  const { baseUrl, close } = await startTestServer();
  t.after(close);

  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as HealthResponse;

  assert.deepEqual(body.bridge, {
    activeSessionCount: 1,
    idleTimeoutMs: 20000,
    sweepIntervalMs: 5000,
    lastSweepAt: 1710000003000
  });

  assert.equal(body.sessions.length, 1);
  assert.deepEqual(body.sessions[0], mockedSessions[0]);
});

test('GET /healthz returns JSON content type', async (t) => {
  patchStreamManager(t, {
    sessions: [],
    runtime: {
      activeSessionCount: 0,
      idleTimeoutMs: 15000,
      sweepIntervalMs: 10000,
      lastSweepAt: null
    }
  });

  const { baseUrl, close } = await startTestServer();
  t.after(close);

  const response = await fetch(`${baseUrl}/healthz`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
});
