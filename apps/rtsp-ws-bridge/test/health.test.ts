import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';

import { registerHealthRoutes } from '../src/routes/health.js';

async function startTestServer(app: ReturnType<typeof express>): Promise<{
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
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

test('/healthz returns bridge runtime and upstreams', async (t) => {
  const app = express();

  registerHealthRoutes(app, {
    streamManager: {
      getAllSessionSnapshots: () => [
        {
          sessionId: 'session-1',
          streamId: 'camera-01',
          rtspUrl: 'rtsp://example.local/live/camera-01',
          pid: 12345,
          state: 'running',
          clientCount: 2,
          lastStartedAt: 1000,
          lastDataAt: 2000,
          restartCount: 0,
          lastErrorAt: null
        }
      ],
      getRuntimeStats: () => ({
        activeSessionCount: 1,
        activeUpstreamCount: 1,
        totalClientCount: 2,
        idleTimeoutMs: 30000,
        sweepIntervalMs: 5000,
        lastSweepAt: 3000,
        upstreams: [
          {
            streamId: 'camera-01',
            upstreamKey: 'rtsp://example.local/live/camera-01',
            rtspUrl: 'rtsp://example.local/live/camera-01',
            createdAt: 500,
            clientCount: 2,
            state: 'running',
            pid: 12345,
            restartCount: 0,
            lastStartedAt: 1000,
            lastDataAt: 2000,
            lastErrorAt: null
          }
        ]
      })
    }
  });

  const { baseUrl, close } = await startTestServer(app);
  t.after(close);

  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.service, 'rtsp-ws-bridge');
  assert.equal(body.bridge.activeSessionCount, 1);
  assert.equal(body.bridge.activeUpstreamCount, 1);
  assert.equal(body.bridge.totalClientCount, 2);
  assert.equal(Array.isArray(body.upstreams), true);
  assert.equal(body.upstreams.length, 1);
  assert.equal(body.upstreams[0].upstreamKey, 'rtsp://example.local/live/camera-01');
  assert.equal(Array.isArray(body.sessions), true);
  assert.equal(body.sessions.length, 1);
});
