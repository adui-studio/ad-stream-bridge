# Getting Started

## Overview

This page helps you start `rtsp-ws-bridge` locally with minimal setup and complete a first-round runtime verification.

The current phase focuses on:

- starting the service
- verifying websocket access
- verifying the `/live/:id` route
- checking `/healthz`
- observing FFmpeg lifecycle and recovery behavior

## Prerequisites

Before you begin, make sure your local environment has:

- Node.js 24+
- pnpm
- a working ffmpeg executable
- an RTSP source for testing, if available

## Install Dependencies

From the repository root:

```bash
pnpm install
```

## Prepare Environment Variables

Create a local env file from the example:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

A minimal example looks like:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
FFMPEG_PATH=ffmpeg
RTSP_URL_TEMPLATE=
STREAM_IDLE_TIMEOUT_MS=15000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
STREAM_SWEEP_INTERVAL_MS=10000
```

If ffmpeg is not available in system PATH, configure an explicit path:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## Start the Service

From the repository root:

```bash
pnpm dev:rtsp-ws-bridge
```

Default addresses:

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

If startup succeeds, you should see the service startup log in the terminal.

## Verify Basic HTTP

First confirm the service is alive:

```bash
curl http://localhost:3000/
```

Then inspect the health endpoint:

```bash
curl http://localhost:3000/healthz
```

You should at least see:

- `ok`
- `service`
- `status`
- `runtime`
- `config`
- `bridge`
- `sessions`

## Verify Basic WebSocket

Start with the diagnostic route:

```text
ws://localhost:3000/ws-ping
```

Expected behavior:

- websocket connection is established
- server sends an initial JSON response
- sending `hello` returns an echo response

This route is useful to confirm:

- websocket upgrade works
- express-ws is registered correctly
- your local client/tooling works as expected

## Verify the Live Route

### Option A: Pass RTSP URL explicitly

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

### Option B: Use RTSP template mapping

If `.env` contains:

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

then you can connect to:

```text
ws://localhost:3000/live/camera-01
```

The service will then:

1. validate `:id`
2. resolve the RTSP source
3. create or fetch the stream session
4. attach the websocket client
5. start FFmpeg session lifecycle

## Inspect Runtime State

After opening a live connection, call:

```bash
curl http://localhost:3000/healthz
```

Focus on the following fields:

### `bridge`

- `activeSessionCount`
- `idleTimeoutMs`
- `sweepIntervalMs`
- `lastSweepAt`

### `sessions`

Each snapshot should include fields such as:

- `streamId`
- `sessionId`
- `state`
- `pid`
- `clientCount`
- `restartCount`
- `lastRestartAt`
- `lastStartedAt`
- `lastStoppedAt`
- `lastDataAt`
- `lastErrorAt`
- `lastExitCode`
- `lastExitSignal`

## Suggested Minimal Debug Flow

Recommended verification order:

1. `GET /`
2. `GET /healthz`
3. `WS /ws-ping`
4. `WS /live/:id`
5. `GET /healthz` again
6. inspect session create / start / exit / restart / destroy logs

## Debug Routes

Debug-only routes such as `/error-test` are **not registered by default**.

This is intentional, so regular runtime environments do not expose error-injection endpoints unless they are explicitly needed.

### Default behavior

By default:

- `/error-test` is not available
- requests to that path should return `404`
- normal runtime paths should not include debug-only routes

### How to enable explicitly

If you need to test error middleware behavior or debug the error handling path, enable debug routes explicitly with:

```env
ENABLE_DEBUG_ROUTES=true
```

For example:

```bash
ENABLE_DEBUG_ROUTES=true pnpm dev:rtsp-ws-bridge
```

When enabled, `/error-test` will be registered and can be used to trigger a test error intentionally.

### Notes

- this is intended only for local debugging or controlled development environments
- it should remain disabled in regular runtime environments
- debug routes should not be treated as part of the public or business-facing API surface

## Common Startup Issues

### `spawn ffmpeg ENOENT`

This means ffmpeg cannot be found locally:

- ffmpeg is not installed
- ffmpeg is not in PATH
- `FFMPEG_PATH` is incorrect

Check:

```bash
ffmpeg -version
```

### `.env` is not applied

Make sure:

- `.env` exists at the repository root
- the dev script reads the root `.env`
- the service is started from the monorepo root

### `/live/:id` connects but no media output appears

Typical causes:

- RTSP URL is invalid
- ffmpeg cannot reach upstream
- upstream is reachable but does not produce valid output
- the current test source is only a placeholder

Inspect:

- `/healthz`
- ffmpeg stderr logs
- restart / idle recovery logs
