<p align="center">
  <img src="./docs/public/ad-stream-bridge-logo.svg" alt="ad-stream-bridge logo" width="360" />
</p>

<h1 align="center">ad-stream-bridge</h1>

<p align="center">
  A production-oriented for backend stream bridging services.
</p>

<p align="center">
  <strong>Phase 1:</strong> RTSP Input → WebSocket-FLV Output
</p>

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README.EN.md">English</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white">
  <img alt="Turbo" src="https://img.shields.io/badge/Turborepo-monorepo-EF4444?logo=vercel&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-phase--1-blue">
  <img alt="License" src="https://img.shields.io/github/license/adui-studio/ad-stream-bridge">
</p>

---

## Overview

**ad-stream-bridge** is a backend-first monorepo for stream bridging services.

The repository is intended to host multiple bridge implementations over time, but **Phase 1** focuses on a single, stable foundation:

- **Bridge:** `rtsp-ws-bridge`
- **Flow:** `RTSP Input → WebSocket-FLV Output`

The priority of the current phase is:

- lifecycle correctness
- restart/recovery behavior
- websocket cleanup
- operability and observability
- monorepo structure that can grow later

This project is intentionally conservative in scope at the beginning.

---

## Why this repository exists

Many streaming projects jump too early into feature breadth:

- multiple protocols
- management UI
- auth
- upstream reuse
- dashboards
- deployment complexity

This repository takes the opposite approach.

Phase 1 focuses on making **one bridge path**:

- runnable
- inspectable
- restartable
- recoverable
- easy to evolve

That gives later phases a cleaner foundation for:

- shared upstream reuse
- additional bridges
- metrics and monitoring
- admin capabilities

---

## Status at a Glance

| Area                                  | Status  |
| ------------------------------------- | ------- |
| Monorepo foundation                   | Done    |
| Express service                       | Done    |
| WebSocket route `/live/:id`           | Done    |
| FFmpeg session lifecycle              | Done    |
| Unexpected-exit auto restart skeleton | Done    |
| Idle/no-data recovery skeleton        | Done    |
| `/healthz` runtime state              | Done    |
| Shared upstream                       | Not yet |
| Auth                                  | Not yet |
| Frontend player app                   | Not yet |
| Other protocols                       | Not yet |

---

## Feature Highlights

### Stable bridge-first architecture

The current app is built around a clear separation of concerns:

- route layer handles websocket access and validation
- stream manager owns session orchestration
- ffmpeg session owns subprocess lifecycle
- health route exposes runtime/session visibility

### Recovery-oriented behavior

Implemented baseline resilience includes:

- restart after unexpected FFmpeg exit
- no restart after manual stop
- idle recovery when stdout data stops arriving
- session cleanup after websocket disconnect
- max restart guard to avoid endless retry loops

### Operability built in early

The project already includes:

- structured logging around stream lifecycle
- `streamId / sessionId / pid / reason` log fields
- `/healthz` with bridge runtime information
- env-driven runtime tuning for restart and recovery

---

## Scope of Phase 1

### In Scope

- `rtsp-ws-bridge`
- RTSP input
- WebSocket-FLV output
- FFmpeg-managed bridge process
- session lifecycle management
- health and runtime inspection
- Docker / PM2 friendly service layout

### Out of Scope

- shared upstream reuse
- frontend player app
- auth system
- admin console
- database
- Kubernetes manifests
- protocol expansion beyond RTSP → WS-FLV

---

## Repository Structure

````text
.
├─ apps
│  └─ rtsp-ws-bridge
├─ packages
│  ├─ config
│  ├─ logger
│  ├─ shared
│  ├─ eslint-config
│  └─ typescript-config
├─ docs
├─ .github
└─ ...
~~~

Primary app in the current phase:

- `apps/rtsp-ws-bridge`

------

## Quick Start

### 1. Install dependencies

```bash
pnpm install
````

### 2. Prepare environment variables

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Start local development server

```bash
pnpm dev:rtsp-ws-bridge
```

Default endpoints:

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

---

## WebSocket Usage

### Connectivity check

Use the diagnostic route first:

```text
ws://localhost:3000/ws-ping
```

Expected behavior:

- websocket upgrade succeeds
- server sends an initial JSON message
- sending `hello` returns an echo response

### Live route

#### Option A: pass RTSP URL directly

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

#### Option B: use template-based RTSP mapping

When configured:

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

you can connect using:

```text
ws://localhost:3000/live/camera-01
```

The server will:

- validate `:id`
- resolve RTSP source
- create or reuse a managed session
- attach the websocket client
- start FFmpeg lifecycle if needed

---

## Minimal Local Verification

### Verify service health

```bash
curl http://localhost:3000/healthz
```

### Verify raw websocket connectivity

```text
ws://localhost:3000/ws-ping
```

### Verify live bridge route

```text
ws://localhost:3000/live/test?url=rtsp://example.com/live.sdp
```

### Re-check runtime state

Call `/healthz` again and verify:

- active session count
- session snapshots
- sweep status
- restart and idle-related timestamps

---

## Environment Variables

Example:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
STREAM_SWEEP_INTERVAL_MS=10000
```

### Important variables

- `HOST`: bind host
- `PORT`: server port
- `LOG_LEVEL`: log level
- `RTSP_URL_TEMPLATE`: RTSP source template when `?url=` is not passed
- `FFMPEG_PATH`: ffmpeg executable path
- `STREAM_IDLE_TIMEOUT_MS`: idle/no-data threshold
- `STREAM_RESTART_DELAY_MS`: retry delay after unexpected exit
- `STREAM_MAX_RESTARTS`: max restart attempts
- `STREAM_SWEEP_INTERVAL_MS`: session sweep interval

---

## Recovery Strategy

Current recovery behavior is intentionally simple and explicit:

- **unexpected FFmpeg exit triggers restart**
- **manual stop does not restart**
- **idle timeout triggers restart-based recovery**
- **retries stop after the configured max restart count**

This is enough for Phase 1 to prioritize correctness and operability without over-designing the runtime.

---

## Health and Observability

### `GET /healthz`

`/healthz` is more than a static liveness check.

It exposes bridge runtime state such as:

- service/runtime metadata
- resolved config summary
- active session count
- sweep status
- session snapshots

### Logging

Key lifecycle logs include:

- websocket connect / disconnect
- session create / destroy
- ffmpeg start / exit / restart
- idle recovery trigger

Primary log fields are aligned around:

- `streamId`
- `sessionId`
- `pid`
- `reason`

That makes a single stream path traceable from connection to cleanup.

---

## Common Issues

### `spawn ffmpeg ENOENT`

This usually means:

- ffmpeg is not installed
- ffmpeg is not in system `PATH`
- `FFMPEG_PATH` is incorrect

Check:

```bash
ffmpeg -version
```

Or configure explicitly on Windows:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

### Live route connects but no media output

Typical causes:

- invalid RTSP URL
- ffmpeg cannot reach the source
- source is reachable but produces no output
- local test uses a placeholder source

Use:

- `/healthz`
- ffmpeg stderr logs
- restart / idle recovery logs

to inspect the runtime.

---

## Current Limitations

Phase 1 does **not** implement shared upstream yet.

That means:

- upstream fan-out for the same RTSP source is intentionally deferred
- lifecycle correctness and cleanup are prioritized first
- shared upstream will be introduced later as a separate evolution step

Other deferred items:

- auth
- frontend player
- admin UI
- database
- k8s configs
- protocol expansion

---

## Development Workflow

Recommended GitHub workflow:

1. create an Issue first
2. branch from `dev`
3. use branch names:

- `feature/*`
- `fix/*`
- `chore/*`
- `docs/*`

4. open PR into `dev`
5. review + CI
6. merge into `main` after stabilization

Also use:

- Labels
- Milestones
- Project Board

---

## Useful Commands

### Start dev server

```bash
pnpm dev:rtsp-ws-bridge
```

### Lint

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

### Typecheck

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
```

### Build

```bash
pnpm build
```

---

## Roadmap

Later phases may expand into:

- shared upstream reuse
- RTMP / HLS / WebRTC / MPEG-TS bridges
- auth
- metrics and monitoring
- admin UI
