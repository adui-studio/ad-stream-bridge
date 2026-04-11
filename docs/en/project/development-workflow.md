# Development Workflow

## Overview

The repository follows a direct, engineering-oriented GitHub workflow.

Recommended principles:

- create an Issue first
- branch from `dev`
- PR into `dev`
- merge into `main` only after stabilization

## Branch Strategy

Recommended branch prefixes:

- `feature/*`
- `fix/*`
- `chore/*`
- `docs/*`

Examples:

- `feature/rtsp-ws-bridge-core-pipeline`
- `fix/ws-route-registration-order`
- `chore/update-eslint-config`
- `docs/update-vitepress-homepage`

## Issue First

Before implementation begins, create an Issue.

A good Issue should usually include:

- title
- type
- goal
- scope
- acceptance criteria

Larger topics should be broken into smaller tasks whenever possible.

## PR Flow

Recommended process:

1. update local `dev`
2. create a feature branch from `dev`
3. make small logical commits
4. open a PR into `dev`
5. wait for review
6. wait for CI to pass
7. merge into `dev`
8. merge from `dev` into `main` after stabilization

## Labels / Milestones / Project Board

Recommended supporting conventions:

### Labels

Examples:

- `feature`
- `fix`
- `chore`
- `docs`
- `bridge`
- `rtsp-ws`
- `backend`
- `phase-1`

### Milestones

Example:

- `Phase 1 - rtsp-ws-bridge MVP`

### Project Board

Examples:

- Todo
- In Progress
- In Review
- Done

## Local Verification Checklist

Before opening a PR, verify at minimum:

- the service starts successfully
- `/healthz` returns expected data
- `/ws-ping` can connect
- `/live/:id` can connect
- invalid ids are rejected
- sessions are created and destroyed correctly
- lint passes
- typecheck passes
- build passes

## Documentation Sync Expectations

Any change that affects runtime behavior, API shape, configuration, or recovery strategy should update documentation as part of the same PR.

At minimum, keep these aligned:

- `README.md`
- `.env.example`
- VitePress documentation
- `/healthz` response description

A good practice is:

- keep code changes and doc changes in the same PR
- avoid postponing documentation updates
