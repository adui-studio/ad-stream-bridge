# Healthz

## Overview

`GET /healthz` returns the current bridge service health and runtime state.

It is not only a static liveness endpoint. It is intended as a runtime-oriented inspection endpoint.

## Response Shape

A typical response includes:

- `ok`
- `service`
- `status`
- `timestamp`
- `uptimeSec`
- `runtime`
- `config`
- `bridge`
- `sessions`

## Runtime Section

`runtime` describes the current process and environment, for example:

- `nodeVersion`
- `platform`
- `arch`
- `pid`
- `nodeEnv`

Use cases:

- confirm runtime version
- distinguish deployment environments
- investigate environment mismatches

## Config Section

`config` exposes the currently effective config summary, for example:

- `host`
- `port`
- `logLevel`
- `ffmpegPath`
- `rtspUrlTemplate`
- `streamRestartDelayMs`
- `streamMaxRestarts`
- `streamIdleTimeoutMs`
- `streamSweepIntervalMs`

Use cases:

- confirm `.env` is applied
- verify fallback/default behavior
- diagnose configuration issues

## Bridge Section

`bridge` describes the current manager runtime state, for example:

- `activeSessionCount`
- `idleTimeoutMs`
- `sweepIntervalMs`
- `lastSweepAt`

Use cases:

- check whether active sessions exist
- check whether the sweep loop is running
- verify idle detection is progressing

## Sessions Section

`sessions` is the list of current managed session snapshots.

Each snapshot typically includes:

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

## How to Use It in Debugging

Recommended usage scenarios:

### 1. Startup verification

Confirm the service is up and config has been loaded.

### 2. After opening a live connection

Confirm:

- `activeSessionCount` increases
- a new session appears
- `clientCount` looks correct

### 3. After disconnecting

Confirm:

- the session is cleaned up
- `activeSessionCount` drops
- idle session removal has happened

### 4. Recovery validation

Inspect:

- `restartCount`
- `lastRestartAt`
- `lastDataAt`
- `lastExitCode`
- `lastExitSignal`

## Known Limits

The current `/healthz` endpoint is still a Phase 1 implementation. It prioritizes usefulness over completeness.

It does not yet include:

- Prometheus metrics
- deeper performance statistics
- historical session aggregation
- alerting integration

Its role is:

- current runtime inspection
- local debugging
- deployment verification support
