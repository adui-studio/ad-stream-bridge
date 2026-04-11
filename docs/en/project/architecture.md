# Architecture

## Goals

The architecture goals for Phase 1 are straightforward:

- make the RTSP → WebSocket-FLV bridge path work
- preserve baseline lifecycle correctness
- preserve baseline recovery behavior
- make runtime state observable
- leave structure for future expansion

## Current Scope

The current architecture is centered around one app:

- `apps/rtsp-ws-bridge`

It focuses on:

- websocket live routes
- stream manager
- ffmpeg session
- health and runtime inspection

## Layered Structure

### Route Layer

Responsibilities:

- expose HTTP / WebSocket entry points
- parse and validate parameters
- reject invalid requests early
- delegate live connections to the stream manager

It does not:

- manage FFmpeg subprocesses directly
- own session lifecycle directly
- make recovery decisions directly

### Stream Manager

Responsibilities:

- create or fetch sessions
- bind websocket clients to sessions
- manage idle sweep
- clean up idle sessions
- trigger idle recovery

It acts as the orchestration layer between the route layer and FFmpeg session runtime.

### FFmpeg Session

Responsibilities:

- start FFmpeg subprocess
- stop FFmpeg subprocess
- restart after unexpected exit
- handle stdout / stderr / exit / error
- fan out stdout to websocket clients
- expose session runtime snapshot

It is the core runtime unit of the current bridge path.

## Data Flow

The current main flow is roughly:

1. client connects to `WS /live/:id`
2. route layer validates `:id`
3. route layer resolves `?url=` or template mapping
4. route layer calls stream manager
5. manager creates or fetches a session
6. manager attaches websocket client
7. session starts FFmpeg
8. FFmpeg stdout is forwarded to websocket
9. manager periodically sweeps for idle detection
10. when the last client disconnects, manager cleans up the session

## Why Shared Upstream Is Deferred

Shared upstream is important, but it introduces a clearly higher level of complexity.

Reasons include:

- upstream lifecycle becomes independent from a single websocket client
- subscriber management is required
- fan-out behavior must be handled
- recovery strategies become more complex
- resource sharing and cleanup boundaries become harder

Introducing shared upstream too early would significantly increase Phase 1 complexity.

So the current phase intentionally defers it and focuses on:

- a single bridge path
- session lifecycle correctness
- recovery and cleanup
- runtime observability

## Future Extension Direction

The current structure can later evolve toward:

- shared upstream
- additional bridge types
- auth
- metrics
- admin UI

All of these should build on a stable Phase 1 runtime foundation.
