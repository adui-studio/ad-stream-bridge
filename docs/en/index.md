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

<div class="vp-doc adui-home-section">
  <div class="adui-home-grid">
    <div class="adui-home-card">
      <div class="adui-home-card__eyebrow">Live Route</div>
      <h2>Minimal runnable bridge entry</h2>
      <p>
        The primary route is <code>/live/:id</code>. The route layer only handles access, validation, and delegation. It does not control FFmpeg directly.
      </p>

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

</div>

<div class="adui-home-card">
  <div class="adui-home-card__eyebrow">Health Check</div>
  <h2>Runtime state is directly inspectable</h2>
  <p>
    Use <code>/healthz</code> to inspect active session count, runtime environment, recovery settings, sweep status, and session snapshots.
  </p>

```bash
curl http://localhost:3000/healthz
```

</div>

  </div>
</div>

<div class="vp-doc adui-home-section">
  <div class="adui-home-banner">
    <div>
      <div class="adui-home-banner__eyebrow">Stability First</div>
      <h2>Make one bridge path stable before expanding protocol and platform scope</h2>
      <p>
        This phase is intentionally narrow. The immediate goal is to make RTSP → WebSocket-FLV runnable, recoverable, cleanly managed, and observable.
      </p>
    </div>
    <div class="adui-home-banner__actions">
      <a class="adui-home-link" href="/en/guide/getting-started">Read getting started →</a>
      <a class="adui-home-link" href="/en/guide/runtime-recovery">View runtime recovery →</a>
      <a class="adui-home-link" href="/en/project/architecture">Read architecture →</a>
    </div>
  </div>
</div>

<div class="vp-doc adui-home-section">
  <div class="adui-home-banner">
    <div>
      <div class="adui-home-banner__eyebrow">Roadmap</div>
      <h2>Structured to evolve toward shared upstream and more bridge types</h2>
      <p>
        The current monorepo layout already leaves room for future shared upstream support, RTMP / HLS / WebRTC / MPEG-TS bridges, auth, metrics, and management UI.
      </p>
    </div>
    <div class="adui-home-banner__actions">
      <a class="adui-home-link" href="/en/project/roadmap">View roadmap →</a>
      <a class="adui-home-link" href="/en/project/development-workflow">View workflow →</a>
      <a
        class="adui-home-link"
        href="https://github.com/adui-studio/ad-stream-bridge"
        target="_blank"
      >
        Visit GitHub →
      </a>
    </div>
  </div>
</div>
