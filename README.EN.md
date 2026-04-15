<p align="center">
  <img src="./docs/public/ad-stream-bridge-logo.svg" alt="ad-stream-bridge logo" width="360" />
</p>

<h1 align="center">ad-stream-bridge</h1>

<p align="center">
  A production-oriented backend stream bridging service
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

## Overview

**ad-stream-bridge** is a backend-first repository for production-oriented stream bridging services.

In **Phase 1**, the project focuses on a single bridge path:

- **Bridge:** `rtsp-ws-bridge`
- **Flow:** `RTSP Input → WebSocket-FLV Output`

The current priority is not feature breadth. It is to make one path stable and operable:

- lifecycle correctness
- restart and recovery behavior
- websocket cleanup
- health visibility
- a repository structure that can grow later

## Current Status

| Area                                  | Status  |
| ------------------------------------- | ------- |
| Monorepo foundation                   | Done    |
| `rtsp-ws-bridge` service              | Done    |
| WebSocket route `/live/:id`           | Done    |
| FFmpeg session lifecycle              | Done    |
| auto restart / idle recovery baseline | Done    |
| shared upstream                       | Done    |
| `/healthz` shared upstream runtime    | Done    |
| auth                                  | Not yet |
| frontend player                       | Not yet |
| other bridge protocols                | Not yet |

## Scope

### Included

- `rtsp-ws-bridge`
- RTSP input
- WebSocket-FLV output
- FFmpeg-managed bridge process
- session lifecycle management
- health and runtime inspection
- Docker / PM2 friendly service layout

### Not Included Yet

- auth
- admin console
- frontend player
- database
- Kubernetes
- multi-protocol expansion

## Repository Structure

```text
.
├─ apps
│  └─ rtsp-ws-bridge
├─ packages
│  ├─ config
│  ├─ logger
│  ├─ eslint-config
│  └─ typescript-config
├─ docs
├─ .github
└─ ...
```

Primary app in the current phase:

- `apps/rtsp-ws-bridge`

## Quick Start

### 1. Install dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Prepare environment variables

Linux / macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Start local development

```bash
pnpm dev:rtsp-ws-bridge
```

Default endpoints:

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

## Minimal Verification

### Health check

```bash
curl http://localhost:3000/healthz
```

### WebSocket connectivity

```text
ws://localhost:3000/ws-ping
```

### Live route

Option A: pass the RTSP URL directly

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

Option B: use template-based mapping

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

```text
ws://localhost:3000/live/camera-01
```

### Shared Upstream Verification

The current version supports shared upstream reuse for the same RTSP source.

Recommended minimal verification flow:

1. connect two clients to the same RTSP upstream
2. request `/healthz`
3. inspect the following fields:

- `bridge.activeSessionCount`
- `bridge.activeUpstreamCount`
- `bridge.totalClientCount`
- `upstreams[*].upstreamKey`
- `upstreams[*].clientCount`

Expected result:

- when two clients connect to the same upstream:
  - `activeUpstreamCount = 1`
  - `totalClientCount = 2`
  - only one upstream entry appears in `upstreams`
  - that upstream has `clientCount = 2`

If different RTSP upstreams are used, multiple upstream entries should appear.

## Docker

### Build the image

```bash
docker build -t ad-stream-bridge .
```

### Run the container

```bash
docker run --rm -p 3000:3000 --env-file .env ad-stream-bridge
```

## Docker Compose

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up --build -d
```

View logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

## CI

The repository includes a baseline CI workflow that runs:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

It is recommended to run the same commands locally before opening a PR.

## Important Environment Variables

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

Focus on:

- `RTSP_URL_TEMPLATE`
- `FFMPEG_PATH`
- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

## Documentation

See `docs` for details:

- Deployment: `docs/en/project/deployment.md`
- Runtime Verification: `docs/en/reference/runtime-verification.md`
- Runtime Recovery: `docs/en/guide/runtime-recovery.md`

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

On Windows, you can configure it explicitly:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

### Live route connects but no media output

Typical causes:

- invalid RTSP URL
- ffmpeg cannot reach the source
- the source is reachable but produces no output

Recommended inspection points:

- `/healthz`
- FFmpeg stderr logs
- restart / idle recovery logs

## Current Limitations

Phase 1 now includes baseline shared upstream support, but several limitations still remain.

Current limitations include:

- only `rtsp-ws-bridge` is supported
- reuse is based on the final resolved RTSP upstream URL
- auth and tenant isolation are not implemented yet
- no admin console yet
- no multi-protocol output expansion yet
- no Kubernetes deployment guidance yet

The current phase still focuses on:

- lifecycle correctness
- resource cleanup
- automatic recovery
- shared upstream runtime observability

## GitHub Workflow

Recommended flow:

1. create an Issue first
2. branch from `dev`
3. use branch prefixes:
   - `feature/*`
   - `fix/*`
   - `chore/*`
   - `docs/*`
4. open a PR into `dev`
5. review + CI
6. merge into `main` after stabilization

## Roadmap

Later phases may expand into:

- shared upstream
- RTMP / HLS / WebRTC / MPEG-TS bridges
- auth
- metrics and monitoring
- admin tooling
