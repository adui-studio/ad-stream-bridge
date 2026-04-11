# Deployment

## Overview

The deployment goal of Phase 1 is not to cover every platform. The priority is to support the following clearly:

- local development
- PM2-based runtime
- Docker-based runtime

Deployment strategy favors simplicity, clarity, and observability.

## Requirements

Recommended baseline requirements:

- Node.js 24+
- pnpm
- a working ffmpeg executable
- reachable RTSP upstream, when doing real stream testing

## Local Run

From the repository root:

```bash
pnpm install
pnpm dev:rtsp-ws-bridge
```

Also ensure:

- `.env` is prepared correctly
- `FFMPEG_PATH` is valid
- the configured port is available

## PM2

The current service structure is suitable for PM2-based process management.

Recommended deployment practices:

- use an explicit `.env`
- collect logs centrally
- use `/healthz` as a basic health check
- observe unexpected exits and restart behavior through PM2 and logs

## Docker

The current project is also suitable for Docker packaging.

Inside the container, make sure:

- ffmpeg is installed
- `FFMPEG_PATH` is correct
- container networking can reach the RTSP upstream
- `/healthz` is available for health probing

## Health Check Recommendations

Deployment environments should at least use:

- `GET /healthz`

to confirm:

- service process is alive
- config is loaded
- active session and sweep state look correct
- session runtime remains observable

## Production Recommendations

For production-like environments, it is recommended to:

- configure `.env` explicitly
- configure `FFMPEG_PATH` explicitly
- avoid relying on implicit PATH behavior
- tune restart and idle parameters reasonably
- set up centralized log collection
- observe FFmpeg stderr and restart logs

## Not Covered Yet

This document does not cover:

- Kubernetes
- Helm
- metrics backend
- distributed session coordination
- management platform integration

These are outside the Phase 1 deployment scope.
