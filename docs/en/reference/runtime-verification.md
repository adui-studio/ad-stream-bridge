# Runtime Verification

This document describes the minimum runtime verification flow for `rtsp-ws-bridge` in the current Phase 1 scope.

## Verification Goals

Confirm that the following capabilities work as expected:

- the service starts successfully
- `/healthz` is reachable
- `/ws-ping` is reachable
- the `/live/:id` route is usable
- shared upstream behavior can be observed and verified
- the containerized startup flow works

## 1. Local Engineering Checks

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected result:

- all commands exit successfully
- no blocking errors remain

## 2. Docker Build Verification

Run:

```bash
docker build -t ad-stream-bridge .
```

Expected result:

- the image builds successfully
- no dependency installation failure occurs
- no Dockerfile blocking errors occur

## 3. Docker Compose Runtime Verification

Run:

```bash
docker compose up --build -d
docker compose ps
```

Expected result:

- the `rtsp-ws-bridge` container is running
- the health check eventually passes

View logs:

```bash
docker compose logs -f
```

## 4. HTTP and WebSocket Endpoint Verification

### 1. `/healthz`

```bash
curl http://localhost:3000/healthz
```

Expected result:

- returns HTTP 200
- includes current bridge runtime information
- includes shared upstream runtime fields

Focus on:

- `bridge.activeSessionCount`
- `bridge.activeUpstreamCount`
- `bridge.totalClientCount`
- `upstreams`

### 2. `/ws-ping`

You can verify this with a browser, a WebSocket client, or the existing local debugging flow:

```text
ws://localhost:3000/ws-ping
```

Expected result:

- WebSocket upgrade succeeds
- the server sends an initial message
- basic echo or diagnostic behavior works

## 5. Live Route Verification

Route:

```text
WS /live/:id
```

Option A: pass the RTSP URL directly

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

Option B: use template-based mapping

```text
ws://localhost:3000/live/camera-01
```

with:

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

Suggested validation points:

- the connection is established successfully
- the route does not disconnect immediately
- logs show the related session lifecycle
- when the client disconnects, server-side cleanup completes correctly

## 6. Shared Upstream Verification

It is recommended to verify at least the following two scenarios.

### Scenario A: same upstream is reused

Connect two clients to the same RTSP upstream.

Expected result:

- `/healthz.bridge.activeUpstreamCount = 1`
- `/healthz.bridge.totalClientCount = 2`
- `/healthz.upstreams` contains only one upstream entry for that source
- that upstream entry has `clientCount = 2`

### Scenario B: different upstreams remain isolated

Connect two clients to different RTSP upstreams.

Expected result:

- `/healthz.bridge.activeUpstreamCount >= 2`
- `/healthz.upstreams` contains multiple upstream entries
- each upstream entry has a `clientCount` that matches the actual client count

## 7. Exception Scenario Verification

It is recommended to manually verify at least the following scenarios:

- the client disconnects intentionally
- the RTSP source is unreachable
- FFmpeg exits unexpectedly
- no data is produced for a long time and recovery is triggered
- service recovery after container restart

## 8. Log Inspection Guidance

Use the following command to inspect runtime behavior:

```bash
docker compose logs -f
```

Focus on:

- upstream creation
- session creation
- FFmpeg start
- FFmpeg exit
- restart / idle recovery
- WebSocket disconnect cleanup
- shared upstream client count changes

## 9. Boundary Between Tests and Runtime Verification

Current automated tests are primarily designed to protect lifecycle semantics and runtime logic boundaries, not to replace real RTSP / FFmpeg environment verification.

In other words:

- automated tests protect logic and lifecycle regressions
- local validation with a real RTSP source confirms external dependency behavior

Both are important, but they serve different purposes.

## 10. Not in Scope Yet

The following capabilities are not implemented yet and should not be included in the current runtime verification baseline:

- auth
- multi-protocol output
- admin console
- frontend player
