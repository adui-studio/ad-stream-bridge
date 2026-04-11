---
layout: home

hero:
  name: 'ad-stream-bridge'
  text: '面向生产可用性的流桥接服务'
  tagline: '第一阶段聚焦 RTSP Input → WebSocket-FLV Output，优先保证生命周期正确性、自动恢复、资源清理与可观测性。'
  image:
    src: /ad-stream-bridge-logo.svg
    alt: ad-stream-bridge
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看 API
      link: /reference/api
    - theme: alt
      text: English Docs
      link: /en/

features:
  - icon: 🌉
    title: Stream Bridge First
    details: 第一阶段只聚焦一条桥接主链路：RTSP 输入 → WebSocket-FLV 输出，不追求一开始就做全协议铺开。
  - icon: ♻️
    title: Recovery-Oriented Runtime
    details: 内置 FFmpeg 异常退出自动重启骨架、无数据 idle recovery 骨架，以及最大重启次数保护。
  - icon: 🧹
    title: Lifecycle Cleanup
    details: WebSocket 断开后会清理 client 绑定、停止空闲 session，并避免残留监听器与僵尸资源。
  - icon: 🩺
    title: Health & Runtime State
    details: /healthz 不只是静态存活检查，还会输出 active sessions、sweep 状态、session 快照与运行时信息。
  - icon: 🧱
    title: Monorepo Foundation
    details: 基于 Turborepo + pnpm workspace + TypeScript，当前结构面向后续 shared upstream 与多 bridge 扩展。
  - icon: 🚫
    title: Deliberate Scope Control
    details: 当前阶段先不做 shared upstream、auth、frontend app、database 与 k8s，优先把核心服务端链路做稳。
---

<div class="vp-doc adui-home-section">
  <div class="adui-home-grid">
    <div class="adui-home-card">
      <div class="adui-home-card__eyebrow">Live Route</div>
      <h2>最小可运行的桥接入口</h2>
      <p>
        当前主入口是 <code>/live/:id</code>。路由层只负责接入、参数校验与委托，不直接处理 FFmpeg 进程。
      </p>

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

</div>

<div class="adui-home-card">
  <div class="adui-home-card__eyebrow">Health Check</div>
  <h2>运行态可直接观察</h2>
  <p>
    通过 <code>/healthz</code> 可以直接检查 active session 数、运行时环境、恢复参数、sweep 状态与 session 快照。
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
      <h2>先把一条 bridge 主链路做稳，再扩协议与能力</h2>
      <p>
        当前阶段只做一件事：把 RTSP → WebSocket-FLV 这条链路做到可运行、可恢复、可清理、可观测。
      </p>
    </div>
    <div class="adui-home-banner__actions">
      <a class="adui-home-link" href="/guide/getting-started">阅读快速开始 →</a>
      <a class="adui-home-link" href="/guide/runtime-recovery">查看恢复策略 →</a>
      <a class="adui-home-link" href="/project/architecture">阅读架构说明 →</a>
    </div>
  </div>
</div>

<div class="vp-doc adui-home-section">
  <div class="adui-home-banner">
    <div>
      <div class="adui-home-banner__eyebrow">Roadmap</div>
      <h2>为后续 shared upstream 与多 bridge 扩展保留结构</h2>
      <p>
        当前 monorepo 结构已经为后续能力演进预留空间，包括 shared upstream、RTMP / HLS / WebRTC / MPEG-TS bridge、
        auth、metrics 与管理界面。
      </p>
    </div>
    <div class="adui-home-banner__actions">
      <a class="adui-home-link" href="/project/roadmap">查看路线图 →</a>
      <a class="adui-home-link" href="/project/development-workflow">查看研发流程 →</a>
      <a
        class="adui-home-link"
        href="https://github.com/adui-studio/ad-stream-bridge"
        target="_blank"
      >
        访问 GitHub →
      </a>
    </div>
  </div>
</div>
