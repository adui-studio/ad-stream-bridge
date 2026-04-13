# Runtime Recovery

## Overview

This page describes the baseline recovery strategy implemented in the current phase.

The goal of Phase 1 recovery is not sophistication. It is to be **explicit, observable, debuggable, and verifiable**:

- unexpected FFmpeg exits trigger automatic restart
- manual stop does not trigger restart
- long periods without output trigger recovery
- recovery should preserve existing websocket clients whenever possible
- retries stop after the max restart count is reached
- a session is only destroyed when no websocket clients remain

At this stage, the runtime explicitly distinguishes between:

- **FFmpeg process restart**
- **session teardown**

These are not the same operation and must not be treated as one.

## Goals

The current recovery strategy is designed to address:

- unexpected FFmpeg process exits
- invalid or unavailable upstream RTSP sources
- cases where FFmpeg still exists but produces no output
- uncontrolled infinite restart loops
- accidental websocket client cleanup during recovery
- accidental session destroy during process restart

## Session Lifecycle Boundaries

### 1. Recovery restart is not session destroy

When a session enters recovery restart:

- the old FFmpeg process is stopped
- a new FFmpeg process is started after the old process exits
- existing websocket clients are preserved
- the session itself is not destroyed

In other words, restart is intended to recover stream output, not to end the session.

### 2. Manual stop is allowed to clear clients

When a session is intentionally stopped:

- the FFmpeg process is stopped
- further automatic restart is disabled
- websocket clients attached to the session are cleared and detached
- the session becomes eligible for final teardown

This means the session has been logically ended by runtime intent.

### 3. Session destroy is owned by StreamManager

Session teardown is not decided by FFmpeg process exit alone. It is decided by `StreamManager`.

The current rule is:

- a session may only be destroyed when **no websocket clients remain**
- if clients are still attached, the session must not be destroyed
- idle recovery / restart must not accidentally tear down a live session

This means:

- **process exit != session end**
- **process restart != session destroy**

## Automatic Restart

When FFmpeg exits unexpectedly, the session enters the automatic restart flow.

The basic sequence is:

1. record exit information
2. determine whether this was a manual stop
3. if not manual, wait for `STREAM_RESTART_DELAY_MS`
4. increment `restartCount`
5. attempt to start FFmpeg again
6. stop retrying after `STREAM_MAX_RESTARTS`

Relevant state fields include:

- `restartCount`
- `lastRestartAt`
- `lastExitCode`
- `lastExitSignal`

Under the current lifecycle rules, automatic restart is expected to:

- preserve existing websocket clients whenever possible
- recover FFmpeg stream output
- avoid destroying the session by default

## Manual Stop Does Not Restart

This is a key rule in the current phase.

If a session is intentionally stopped by runtime logic, for example:

- the last websocket client disconnects
- the stream manager explicitly stops the session
- `stop()` is called intentionally

then FFmpeg exit must not trigger another restart.

This avoids:

- restarting a session that has already been logically ended
- consuming resources with no active clients
- interfering with manager cleanup behavior

At the same time, manual stop is allowed to:

- clear websocket client bindings
- move the session toward final teardown

## Idle Recovery

### Background

Some failures do not appear as a direct process exit. FFmpeg may remain alive while upstream is already unusable, or the process may no longer produce valid stdout data.

Relying only on exit/error events is not enough to detect this class of failure.

### Detection Rule

The manager sweeps active sessions using `STREAM_SWEEP_INTERVAL_MS`.

A session is treated as idle/stalled when all the following are true:

- it still has websocket clients
- it is in `running` state
- `lastDataAt` has not been updated for too long
- the threshold exceeds `STREAM_IDLE_TIMEOUT_MS`

### Recovery Action

In Phase 1, the simplest and safest action is used:

- trigger `restart()`
- `restart()` only recovers the FFmpeg process
- existing websocket clients are preserved during recovery
- restart does not destroy the session

This allows the idle recovery path to reuse the existing restart lifecycle instead of introducing a second recovery state machine.

## Max Restart Protection

To avoid endless retry loops, the runtime enforces a maximum restart count.

When:

```text
restartCount >= STREAM_MAX_RESTARTS
```

the session:

- stops attempting automatic restart
- enters an error state
- logs an error event

This helps prevent:

- endless noisy retry loops
- repeated process creation with no recovery chance
- uncontrolled resource usage

Note:

- reaching the max restart limit moves the session into `errored`
- this does not automatically mean immediate session teardown
- final cleanup is still decided by `StreamManager` based on client presence and cleanup flow

## Related Configuration

The main recovery-related env variables are:

- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_SWEEP_INTERVAL_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

These should usually differ by environment.

### Local debugging

Use smaller values to make recovery easier to verify, for example:

- shorter idle timeout
- shorter restart delay
- smaller max restart count

### Stable runtime environments

Use more conservative values to avoid overly sensitive recovery behavior, for example:

- more conservative idle timeout
- more reasonable restart delay
- bounded automatic recovery attempts

## Current Limitations

Phase 1 intentionally keeps recovery simple and does not yet include:

- complex backoff
- rolling-window retry accounting
- multi-stage recovery policies
- shared-upstream-aware recovery
- direct integration with metrics / alerting systems
- multi-priority recovery orchestration
- a more complex session state machine

At this stage, the priorities are:

- clear lifecycle boundaries
- avoiding accidental websocket client cleanup
- clear manager cleanup ownership
- recovery paths that are easy to trace and debug

## Debugging Tips

When recovery behavior looks wrong, inspect in this order:

1. `/healthz`
2. session snapshot fields such as `state / restartCount / lastRestartAt / lastDataAt`
3. FFmpeg stderr logs
4. exit / restart / idle recovery logs
5. RTSP source validity
6. whether websocket clients are still attached
7. whether session destroy was triggered unexpectedly

The most important log fields are:

- `streamId`
- `sessionId`
- `pid`
- `reason`

If the problem is “recovery completed but clients still receive no media”, check these first:

- whether clients are still attached after restart
- whether FFmpeg restarted successfully after the old process exited
- whether `lastDataAt` continues to move forward
- whether `clientCount` was unexpectedly reduced to zero during recovery

## Local Testing and Verification

To keep runtime recovery behavior stable as the project evolves, `rtsp-ws-bridge` includes lifecycle-oriented regression tests.

These tests do not aim to validate FFmpeg encoding itself. Their main purpose is to protect the most important runtime guarantees of Phase 1:

- FFmpeg session lifecycle correctness
- restart / recovery semantics
- websocket client retention and cleanup behavior
- stream manager orchestration behavior
- `/healthz` response structure stability

### Current test approach

The current test setup uses:

- Node built-in test runner: `node:test`
- TypeScript execution via: `tsx`
- Test directory: `apps/rtsp-ws-bridge/test/`

Why this approach is used:

- no heavy test framework is required
- it matches the current TypeScript / Node setup of the repository
- it is sufficient for Phase 1 lifecycle regression coverage
- it can be extended later without introducing early tooling complexity

### Common commands

Run all `rtsp-ws-bridge` tests:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge test
```

Run typecheck:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
```

Run lint:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

Build the app:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge build
```

### Recommended local execution order

Before submitting changes, it is recommended to run:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge test
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

If the current change touches runtime logic, also run:

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge build
```

### Current test coverage

#### `ffmpeg-session.lifecycle.test.ts`

Mainly covers:

- whether recovery restart preserves websocket clients
- whether manual stop clears websocket clients
- whether unexpected exit triggers automatic restart
- whether the session enters `errored` after the max restart limit is reached

#### `stream-manager.lifecycle.test.ts`

Mainly covers:

- whether the first client attach triggers session start
- whether multiple clients on the same stream reuse the same session
- whether the last client disconnect triggers stop + destroy
- whether the websocket error path also triggers cleanup

#### `stream-manager.idle-recovery.test.ts`

Mainly covers:

- whether idle timeout triggers restart
- whether no-client sessions are destroyed instead of restarted
- whether non-`running` sessions avoid accidental idle recovery

#### `health-route.test.ts`

Mainly covers:

- whether `/healthz` returns 200
- whether the top-level response structure is complete
- whether `bridge` / `sessions` keep a stable structure
- whether `streamManager` data is correctly exposed by the route

### Debugging tips

If a test fails, inspect in this order:

1. determine whether the test itself is wrong or the runtime behavior has changed
2. if a session lifecycle test fails, inspect:
   - `state`
   - `restartCount`
   - `lastRestartAt`
   - `lastStartedAt`
   - `lastStoppedAt`
   - `lastDataAt`
   - `clientCount`
3. if a manager test fails, check:
   - whether a session was created more than once
   - whether `start()` was triggered multiple times
   - whether `stop()` only happens when no clients remain
   - whether websocket `close` / `error` paths reached cleanup
4. if a `/healthz` test fails, check:
   - whether the route is registered
   - whether `streamManager.getRuntimeStats()` changed shape
   - whether `streamManager.getAllSessionSnapshots()` still returns serializable data

### Note

These tests are primarily designed to protect lifecycle semantics, not to replace real RTSP / FFmpeg environment validation.

In other words:

- tests protect runtime behavior and boundaries
- real local RTSP source validation confirms external dependency behavior

Both are important, but they serve different purposes and should not be treated as the same thing.
