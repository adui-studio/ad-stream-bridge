# Roadmap

## Phase 1

The current Phase 1 focus includes:

- monorepo foundation
- `rtsp-ws-bridge`
- `/live/:id` websocket route
- FFmpeg session lifecycle
- automatic restart skeleton
- idle recovery skeleton
- `/healthz` runtime output
- baseline documentation site

## Near-Term Next Steps

Natural next steps after Phase 1 may include:

- shared upstream design and implementation
- clearer session reuse strategy
- more stable deployment scaffolding
- fuller logging and monitoring integration

## Later Phases

Possible future expansions include:

- shared upstream
- RTMP bridge
- HLS bridge
- WebRTC bridge
- MPEG-TS bridge
- auth
- metrics and monitoring
- admin UI

## Out of Scope for Now

The following are explicitly out of scope for the current phase:

- frontend player app
- database
- k8s configuration
- premature all-protocol unification

The current phase still follows one core principle:

**make one bridge path stable first.**
