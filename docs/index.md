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
