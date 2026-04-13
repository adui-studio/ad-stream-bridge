import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

import { FfmpegSession } from '../src/bridges/rtsp-ws/ffmpeg-session.js';
import { MockWebSocket } from './helpers/mock-websocket.js';

const WAIT_STEP_MS = 50;
const WAIT_TIMEOUT_MS = 5000;

function buildProducerScript(options?: { intervalMs?: number; autoExitAfterMs?: number }): string {
  const intervalMs = options?.intervalMs ?? 80;
  const autoExitAfterMs = options?.autoExitAfterMs;

  return `
const intervalMs = ${intervalMs};
let tick = 0;

const timer = setInterval(() => {
  process.stdout.write(Buffer.from(\`chunk-\${tick++}\\n\`));
}, intervalMs);

const cleanup = () => {
  clearInterval(timer);
};

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

${typeof autoExitAfterMs === 'number' ? `setTimeout(() => { cleanup(); process.exit(0); }, ${autoExitAfterMs});` : ''}
`;
}

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

function createSession(script: string): FfmpegSession {
  return new FfmpegSession({
    streamId: 'camera-a',
    rtspUrl: 'rtsp://example.local/live/camera-a',
    ffmpegPath: process.execPath,
    ffmpegArgs: ['-e', script],
    restartDelayMs: 100,
    maxRestarts: 3
  });
}

test('restart preserves websocket clients and continues forwarding stdout', async () => {
  const session = createSession(
    buildProducerScript({
      intervalMs: 60
    })
  );

  const ws = new MockWebSocket();

  session.attachClient({
    ws: ws as never,
    clientIp: '127.0.0.1'
  });

  session.start();

  await waitFor(() => ws.sent.length >= 2, {
    message: 'expected initial stdout chunks before restart'
  });

  const sentBeforeRestart = ws.sent.length;
  const snapshotBeforeRestart = session.getSnapshot();

  assert.equal(snapshotBeforeRestart.clientCount, 1);
  assert.equal(snapshotBeforeRestart.state, 'running');

  session.restart('test recovery restart');

  await waitFor(
    () => session.getSnapshot().state === 'running' && ws.sent.length > sentBeforeRestart,
    { message: 'expected stdout forwarding to continue after restart' }
  );

  const snapshotAfterRestart = session.getSnapshot();

  assert.equal(snapshotAfterRestart.clientCount, 1);
  assert.equal(snapshotAfterRestart.state, 'running');
  assert.ok(snapshotAfterRestart.restartCount >= 1);
  assert.ok(snapshotAfterRestart.lastRestartAt !== null);

  session.stop('test teardown');

  await waitFor(() => session.getSnapshot().state === 'stopped', {
    message: 'expected session to stop during teardown'
  });
});

test('manual stop clears websocket clients', async () => {
  const session = createSession(
    buildProducerScript({
      intervalMs: 60
    })
  );

  const ws = new MockWebSocket();

  session.attachClient({
    ws: ws as never,
    clientIp: '127.0.0.1'
  });

  session.start();

  await waitFor(() => ws.sent.length >= 1, { message: 'expected stdout before manual stop' });

  session.stop('manual test stop');

  await waitFor(() => session.getSnapshot().state === 'stopped', {
    message: 'expected session to enter stopped state'
  });

  const snapshotAfterStop = session.getSnapshot();

  assert.equal(snapshotAfterStop.clientCount, 0);
  assert.equal(snapshotAfterStop.state, 'stopped');
});

test('unexpected child exit keeps websocket clients and auto restarts session', async () => {
  const session = createSession(
    buildProducerScript({
      intervalMs: 50,
      autoExitAfterMs: 180
    })
  );

  const ws = new MockWebSocket();

  session.attachClient({
    ws: ws as never,
    clientIp: '127.0.0.1'
  });

  session.start();

  await waitFor(() => ws.sent.length >= 1, {
    message: 'expected initial stdout before unexpected exit'
  });

  const beforeExitCount = ws.sent.length;

  await waitFor(() => session.getSnapshot().restartCount >= 1, {
    message: 'expected automatic restart after child exit'
  });

  await waitFor(
    () => session.getSnapshot().state === 'running' && ws.sent.length > beforeExitCount,
    { message: 'expected stdout forwarding to resume after automatic restart' }
  );

  const snapshotAfterAutoRestart = session.getSnapshot();

  assert.equal(snapshotAfterAutoRestart.clientCount, 1);
  assert.equal(snapshotAfterAutoRestart.state, 'running');

  session.stop('test teardown');

  await waitFor(() => session.getSnapshot().state === 'stopped', {
    message: 'expected teardown stop to finish'
  });
});
