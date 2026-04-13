---
layout: home

hero:
  name: 'ad-stream-bridge'
  text: 'A production-oriented stream bridge service'
  tagline: 'Phase 1 focuses on RTSP Input → WebSocket-FLV Output, with stability-first priorities around lifecycle correctness, restart/recovery behavior, resource cleanup, and runtime observability.'
  image:
    src: /ad-stream-bridge-logo.svg
    alt: ad-stream-bridge
  actions:
    - theme: brand
      text: Getting Started
      link: /en/guide/getting-started
    - theme: alt
      text: API Reference
      link: /en/reference/api
    - theme: alt
      text: 中文文档
      link: /

features:
  - icon: 🌉
    title: Stream Bridge First
    details: 'Phase 1 focuses on a single bridge path only: RTSP Input → WebSocket-FLV Output, instead of expanding into many protocols too early.'
  - icon: ♻️
    title: Recovery-Oriented Runtime
    details: Includes an automatic restart skeleton for unexpected FFmpeg exits, idle/no-data recovery, and max restart protection.
  - icon: 🧹
    title: Lifecycle Cleanup
    details: WebSocket disconnect triggers client cleanup, idle session stop, and removal of listener bindings to avoid leaked runtime state.
  - icon: 🩺
    title: Health & Runtime State
    details: /healthz is more than a liveness check. It exposes active sessions, sweep status, runtime information, and session snapshots.
  - icon: 🧱
    title: Monorepo Foundation
    details: Built on Turborepo + pnpm workspace + TypeScript, with structure reserved for future shared upstream and multi-bridge evolution.
  - icon: 🚫
    title: Deliberate Scope Control
    details: Phase 1 intentionally excludes shared upstream, auth, frontend app, database, and k8s to keep the backend bridge path stable first.
---
