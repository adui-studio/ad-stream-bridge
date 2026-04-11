# Runtime Recovery

## Overview

This page explains the baseline recovery strategy implemented in the current phase.

The goal of Phase 1 recovery is not sophistication. It is to be explicit, observable, and debuggable:

- unexpected FFmpeg exits trigger automatic restart
- manual stop does not trigger restart
- long periods without output trigger recovery
- retries stop after the max restart count is reached

## Goals

The current recovery strategy is designed to address:

- unexpected FFmpeg process exits
- invalid or unavailable upstream RTSP sources
- cases where FFmpeg still exists but produces no output
- uncontrolled infinite restart loops

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

## Idle Recovery

### Background

Some failures do not appear as a direct process exit. FFmpeg may remain alive while upstream is already unusable, or the process may no longer produce valid stdout data.

Relying only on exit/error events is not enough to detect this class of failure.

### Detection Rule

The manager sweeps active sessions using `STREAM_SWEEP_INTERVAL_MS`.

A session is treated as idle/stalled when all of the following are true:

- it still has websocket clients
- it is in `running` state
- `lastDataAt` has not been updated for too long
- the threshold exceeds `STREAM_IDLE_TIMEOUT_MS`

### Recovery Action

In Phase 1, the simplest and safest action is used:

- trigger `restart()`

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

## Related Configuration

The main recovery-related env variables are:

- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_SWEEP_INTERVAL_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

These should usually differ by environment:

### Local debugging

Use smaller values to make recovery easier to verify.

### Stable runtime environments

Use more conservative values to avoid overly sensitive restart behavior.

## Current Limitations

Phase 1 intentionally keeps recovery simple and does not yet include:

- complex backoff
- rolling-window retry accounting
- multi-stage recovery policies
- shared-upstream-aware recovery
- direct integration with metrics or alerting systems

## Debugging Tips

When recovery behavior looks wrong, inspect in this order:

1. `/healthz`
2. session snapshot fields such as `state / restartCount / lastRestartAt / lastDataAt`
3. FFmpeg stderr logs
4. exit / restart / idle recovery logs
5. RTSP source validity

The most important log fields are:

- `streamId`
- `sessionId`
- `pid`
- `reason`
