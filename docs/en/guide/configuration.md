# Configuration

## Overview

This page explains the main runtime configuration used by `rtsp-ws-bridge`, including defaults and fallback behavior.

Phase 1 does not aim to build a complex config system. The goal is to centralize the critical runtime settings and avoid reading env variables directly across business code.

## Configuration Overview

The current app and bridge runtime configuration is grouped into four categories:

- App runtime
- RTSP source resolution
- FFmpeg
- Recovery controls

## App Runtime

### `NODE_ENV`

Runtime environment marker, typically one of:

- `development`
- `test`
- `production`

Default:

```env
NODE_ENV=development
```

### `HOST`

Bind address for the service.

Default:

```env
HOST=0.0.0.0
```

### `PORT`

Bind port for the service.

Default:

```env
PORT=3000
```

If the value is not a valid number, or below the minimum allowed value, it falls back to the default.

### `LOG_LEVEL`

Log level.

Suggested values:

- `debug`
- `info`
- `warn`
- `error`

Default:

```env
LOG_LEVEL=info
```

## RTSP Source Resolution

### `RTSP_URL_TEMPLATE`

When a client connects to `/live/:id` without `?url=...`, the service may resolve the RTSP source using this template.

For example:

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

Then:

```text
ws://localhost:3000/live/camera-01
```

will resolve to:

```text
rtsp://your-rtsp-host/live/camera-01
```

If both conditions are true:

- `?url=...` is not provided
- `RTSP_URL_TEMPLATE` is empty

then RTSP resolution fails and session initialization cannot proceed.

## FFmpeg

### `FFMPEG_PATH`

Path to the ffmpeg executable.

Default:

```env
FFMPEG_PATH=ffmpeg
```

This means the service expects ffmpeg to be available in the system PATH.

On Windows, if PATH lookup does not work, configure an absolute path such as:

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## Recovery Controls

### `STREAM_IDLE_TIMEOUT_MS`

Idle/no-data timeout threshold.

If FFmpeg does not produce stdout data for too long, the manager treats the session as stalled and triggers recovery.

Example:

```env
STREAM_IDLE_TIMEOUT_MS=15000
```

### `STREAM_SWEEP_INTERVAL_MS`

Session sweep interval.

The manager periodically checks active sessions for idle state.

Example:

```env
STREAM_SWEEP_INTERVAL_MS=10000
```

### `STREAM_RESTART_DELAY_MS`

Delay before restarting FFmpeg after an unexpected exit.

Example:

```env
STREAM_RESTART_DELAY_MS=3000
```

### `STREAM_MAX_RESTARTS`

Maximum number of automatic restart attempts.

Example:

```env
STREAM_MAX_RESTARTS=5
```

Current semantics:

- `0` means **do not retry**
- values greater than `0` allow up to that many restart attempts

## Defaults and Fallback Rules

The current env module includes basic defaulting and numeric validation.

### String Values

If a value is:

- missing
- or empty after trimming

then the default value is used.

### Numeric Values

If a value is:

- not a valid number
- below the minimum allowed value
- outside the accepted range, when such limits apply

then the default value is used.

For example:

```env
PORT=abc
STREAM_MAX_RESTARTS=-1
STREAM_IDLE_TIMEOUT_MS=hello
```

will fall back to safe defaults rather than producing undefined runtime behavior.

## Example Configurations

### Local development example

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_SWEEP_INTERVAL_MS=10000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
```

### Template-based routing example

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_SWEEP_INTERVAL_MS=10000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
```

## Recommended Settings

### For local debugging

Use smaller values to make recovery behavior easier to observe:

```env
STREAM_IDLE_TIMEOUT_MS=5000
STREAM_SWEEP_INTERVAL_MS=2000
STREAM_RESTART_DELAY_MS=1000
```

### For a more stable runtime

Recommended:

- configure `FFMPEG_PATH` explicitly
- provide a stable `RTSP_URL_TEMPLATE`, or require explicit `?url=...`
- avoid making `STREAM_SWEEP_INTERVAL_MS` too aggressive
- keep a reasonable restart cap instead of unlimited retries
