# Deployment and Runtime

This document describes how to run `ad-stream-bridge` locally, with Docker, and with Docker Compose in the current Phase 1 scope, along with baseline troubleshooting guidance.

## Scope

This document currently applies to:

- app: `rtsp-ws-bridge`
- flow: `RTSP Input -> WebSocket-FLV Output`
- baseline shared upstream support
- `/healthz` upstream runtime output

The following are not implemented yet:

- auth
- admin console
- multi-protocol bridges
- frontend player app

Therefore, this document assumes a single-bridge, single-service, single-container runtime model.

## 1. Local Runtime

### 1. Install dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Prepare environment variables

Copy `.env.example` to `.env` and adjust the values for your environment.

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

### 4. Build the project

```bash
pnpm build
```

## 2. CI Validation

The repository CI runs the following checks on `push` and `pull_request`:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before submitting changes, it is recommended to run the same commands locally to reduce PR iteration cost.

## 3. Docker Runtime

### 1. Build the image

```bash
docker build -t ad-stream-bridge .
```

### 2. Run the container

```bash
docker run --rm -p 3000:3000 --env-file .env ad-stream-bridge
```

### 3. Verify health status

```bash
curl http://localhost:3000/healthz
```

In Windows PowerShell:

```powershell
Invoke-WebRequest http://localhost:3000/healthz
```

## 4. Docker Compose Local Verification

### 1. Start

```bash
docker compose up --build
```

### 2. Start in background

```bash
docker compose up --build -d
```

### 3. Check status

```bash
docker compose ps
```

### 4. View logs

```bash
docker compose logs -f
```

### 5. Stop and clean up

```bash
docker compose down
```

## 5. Recommended Verification Flow

It is recommended to run at least the following after each meaningful change.

### 1. Engineering checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### 2. Container build check

```bash
docker build -t ad-stream-bridge .
```

### 3. Container runtime check

```bash
docker compose up --build -d
curl http://localhost:3000/healthz
docker compose logs --tail=200
```

### 4. Shared Upstream Check

Verify at least one “same upstream” case:

- connect two clients to the same RTSP upstream
- inspect `/healthz`

Expected result:

- `bridge.activeUpstreamCount = 1`
- `bridge.totalClientCount = 2`
- `upstreams` contains only one entry for that upstream
- that entry has `clientCount = 2`

## 6. Environment Variable Notes

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
- `STREAM_IDLE_TIMEOUT_MS`: idle / no-data threshold
- `STREAM_RESTART_DELAY_MS`: restart delay after unexpected exit
- `STREAM_MAX_RESTARTS`: max automatic restart attempts
- `STREAM_SWEEP_INTERVAL_MS`: session sweep interval

## 7. Runtime Inspection Guidance

With shared upstream enabled, `/healthz` should be used as the primary runtime inspection endpoint.

Focus on:

- `bridge.activeSessionCount`
- `bridge.activeUpstreamCount`
- `bridge.totalClientCount`
- `upstreams[*].upstreamKey`
- `upstreams[*].clientCount`
- `upstreams[*].state`
- `upstreams[*].restartCount`

These fields help answer:

- whether upstream reuse is actually happening
- whether duplicated upstream sessions were created unexpectedly
- whether clients were not cleaned up correctly
- whether restart or idle recovery is firing unexpectedly

## 8. Common Troubleshooting

### 1. Docker Hub base image pull failure

Symptoms:

- cannot pull `node:25-bookworm-slim`
- error such as `failed to fetch oauth token`

Recommended checks:

- run `docker login`
- inspect Docker Desktop proxy settings
- check whether a registry mirror is needed
- retry with a different network environment

### 2. Debian source failure while installing FFmpeg

Symptoms:

- `apt-get install ffmpeg` fails with `500`, `502`, or `unexpected EOF`

Recommended checks:

- retry the build
- verify network stability
- switch Debian mirrors if needed
- keep apt retry settings enabled

### 3. Husky breaks production image install

Symptoms:

- `pnpm install --prod` triggers `prepare -> husky`
- error such as `husky: not found`

Recommended handling:

- disable install scripts in the production image
- or ensure husky is not triggered during production install

### 4. `/healthz` is unavailable after container startup

Recommended checks:

- inspect container logs with `docker compose logs -f`
- verify `.env` exists and is valid
- verify the app binds to `0.0.0.0:3000`
- check for host port conflicts

### 5. Shared upstream is not reused as expected

Recommended checks:

- verify that both clients resolve to the same final RTSP upstream URL
- verify whether different `?url=` values were used
- inspect `/healthz.upstreams[*].upstreamKey`
- verify whether URL differences caused multiple upstream keys

### 6. RTSP pull fails

Recommended checks:

- verify that the RTSP URL is reachable
- verify the source camera or stream service is accessible
- verify container networking and firewall rules
- verify `FFMPEG_PATH` is correct

## 9. Current Limitations

This deployment document only covers the current Phase 1 baseline.

The following are not implemented yet:

- auth
- multi-protocol output
- admin console
- frontend player
- Kubernetes

If these capabilities are added later, the deployment documentation should be extended separately.
