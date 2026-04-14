<p align="center">
  <img src="./docs/public/ad-stream-bridge-logo.svg" alt="ad-stream-bridge logo" width="360" />
</p>

<h1 align="center">ad-stream-bridge</h1>

<p align="center">
  面向生产可用性的后端流桥接服务
</p>

<p align="center">
  <strong>第一阶段：</strong>RTSP 输入 → WebSocket-FLV 输出
</p>

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README.EN.md">English</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white">
  <img alt="Turbo" src="https://img.shields.io/badge/Turborepo-monorepo-EF4444?logo=vercel&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-phase--1-blue">
  <img alt="License" src="https://img.shields.io/github/license/adui-studio/ad-stream-bridge">
</p>

## 项目简介

**ad-stream-bridge** 是一个面向后端服务、强调工程化与可运维性的流桥接服务仓库。

当前 **Phase 1** 只聚焦一条主链路：

- **Bridge：** `rtsp-ws-bridge`
- **数据流：** `RTSP 输入 → WebSocket-FLV 输出`

当前阶段重点不是功能铺开，而是先把一条链路做稳，包括：

- 生命周期正确性
- 异常退出重启
- 长时间无数据恢复
- WebSocket 清理
- 健康检查与基础可观测性

## 当前状态

| 模块                              | 状态     |
| --------------------------------- | -------- |
| Monorepo 基础设施                 | 已完成   |
| `rtsp-ws-bridge` 主服务           | 已完成   |
| WebSocket 路由 `/live/:id`        | 已完成   |
| FFmpeg session 生命周期           | 已完成   |
| 自动重启 / idle recovery 基础能力 | 已完成   |
| `/healthz` 运行态输出             | 已完成   |
| shared upstream                   | 暂未实现 |
| 鉴权                              | 暂未实现 |
| 前端播放器                        | 暂未实现 |
| 其他协议 bridge                   | 暂未实现 |

## 当前范围

### 已包含

- `rtsp-ws-bridge`
- RTSP 输入
- WebSocket-FLV 输出
- 基于 FFmpeg 的 bridge 进程
- session 生命周期管理
- 健康检查与运行态输出
- 适合 Docker / PM2 的服务形态

### 暂不包含

- shared upstream
- 鉴权
- 管理后台
- 前端播放器
- 数据库
- Kubernetes
- 多协议扩展

## 仓库结构

```text
.
├─ apps
│  └─ rtsp-ws-bridge
├─ packages
│  ├─ config
│  ├─ logger
│  ├─ eslint-config
│  └─ typescript-config
├─ docs
├─ .github
└─ ...
```

当前阶段主应用：

- `apps/rtsp-ws-bridge`

## 快速开始

### 1. 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 2. 准备环境变量

Linux / macOS：

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

### 3. 启动本地开发服务

```bash
pnpm dev:rtsp-ws-bridge
```

默认地址：

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

## 最小验证

### 健康检查

```bash
curl http://localhost:3000/healthz
```

### WebSocket 连通性

```text
ws://localhost:3000/ws-ping
```

### Live 路由

方式一：直接传 RTSP URL

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

方式二：使用模板映射

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

```text
ws://localhost:3000/live/camera-01
```

## Docker

### 构建镜像

```bash
docker build -t ad-stream-bridge .
```

### 运行容器

```bash
docker run --rm -p 3000:3000 --env-file .env ad-stream-bridge
```

## Docker Compose

```bash
docker compose up --build
```

后台运行：

```bash
docker compose up --build -d
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

## CI

当前仓库已接入基础代码 CI，执行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

建议本地提交前先执行一遍相同命令。

## 关键环境变量

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

重点关注：

- `RTSP_URL_TEMPLATE`
- `FFMPEG_PATH`
- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

## 文档

详细说明见 `docs`：

- 部署与运行：`docs/project/deployment.md`
- 运行验证：`docs/reference/runtime-verification.md`
- 恢复策略：`docs/guide/runtime-recovery.md`

## 常见问题

### `spawn ffmpeg ENOENT`

通常表示：

- ffmpeg 未安装
- ffmpeg 不在系统 `PATH` 中
- `FFMPEG_PATH` 配置错误

检查：

```bash
ffmpeg -version
```

Windows 下可显式配置：

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

### 能连上 live 路由但没有媒体输出

常见原因：

- RTSP 地址无效
- ffmpeg 无法访问上游
- 上游可访问但没有数据输出

建议结合以下信息排查：

- `/healthz`
- FFmpeg stderr 日志
- restart / idle recovery 日志

## 当前限制

当前 Phase 1 **不实现 shared upstream**。

这意味着：

- 同一路 RTSP 的上游复用能力暂不在当前阶段
- 当前重点仍是链路正确性、资源清理和生命周期稳定
- shared upstream 会在后续阶段独立推进

## GitHub 工程流程

推荐流程：

1. 先建 Issue
2. 从 `dev` 拉分支
3. 使用分支命名：
   - `feature/*`
   - `fix/*`
   - `chore/*`
   - `docs/*`
4. 提 PR 到 `dev`
5. Review + CI
6. 稳定后合并到 `main`

## 后续路线

后续阶段可能扩展到：

- shared upstream
- RTMP / HLS / WebRTC / MPEG-TS bridge
- 鉴权
- 指标与监控
- 管理界面
