# API

## Overview

The current phase of `rtsp-ws-bridge` exposes a very small but deliberate set of HTTP and WebSocket interfaces.

The goal is not broad control coverage. It is to support:

- basic service liveness
- runtime inspection
- websocket diagnostics
- live stream access

## HTTP Endpoints

### `GET /`

Basic service liveness endpoint.

Returns:

- `ok`
- `service`
- `message`
- `timestamp`

Useful as the simplest startup confirmation.

### `GET /healthz`

Runtime health endpoint.

Unlike the root route, `/healthz` exposes current bridge runtime state, including:

- service status
- runtime metadata
- config summary
- active session count
- sweep status
- session snapshots

Useful for:

- local debugging
- deployment verification
- session lifecycle inspection
- recovery behavior validation

## WebSocket Endpoints

### `WS /ws-ping`

Used for baseline websocket diagnostics.

Main purposes:

- verify websocket upgrade works
- verify the server can receive and send messages
- isolate local tooling, route registration, or express-ws integration issues

Example:

```text
ws://localhost:3000/ws-ping
```

### `WS /live/:id`

Main live route in the current phase.

Responsibilities:

- validate `:id`
- resolve RTSP source
- create or fetch the managed session
- attach websocket client
- delegate FFmpeg lifecycle handling to the stream manager

Examples:

#### Pass RTSP URL explicitly

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

#### Use RTSP template mapping

```text
ws://localhost:3000/live/camera-01
```

with:

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

## Path Parameters

### `:id`

Must pass basic format validation.

Currently allowed:

- letters
- numbers
- `_`
- `-`

Accepted examples:

- `test`
- `camera-01`
- `office_gate_2`

Rejected examples:

- `camera 01`
- `camera/01`
- empty string

Invalid ids are rejected and the websocket connection is closed.

## Query Parameters

### `url`

Optional RTSP source override.

When present, the explicit URL is normally preferred.
When absent, the service may fall back to `RTSP_URL_TEMPLATE`.

## Error Behavior

### Invalid `id`

The server rejects the connection and closes the websocket.

### RTSP source cannot be resolved

If both are true:

- `?url=...` is not provided
- `RTSP_URL_TEMPLATE` is not configured

then session initialization fails.

### FFmpeg cannot be started

If:

- `FFMPEG_PATH` is incorrect
- ffmpeg cannot be found
- upstream cannot be reached

then FFmpeg process errors will appear in logs.

## Notes

The current API surface is intentionally narrow for Phase 1:

- no advanced control protocol
- no auth
- no shared upstream exposure
- no management-side API

The current focus is to keep the main bridge path stable, observable, and debuggable.
