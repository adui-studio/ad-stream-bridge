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

---

## 项目简介

**ad-stream-bridge** 是一个面向后端服务、强调工程化与可运维性的通用流桥接服务仓库。

仓库后续会逐步承载多个 bridge 实现，但 **Phase 1** 只专注于第一条主链路：

- **Bridge：** `rtsp-ws-bridge`
- **数据流：** `RTSP 输入 → WebSocket-FLV 输出`

当前阶段优先级是：

- 生命周期正确性
- 重启与恢复行为
- websocket 断开清理
- 可观测与可运维
- 为后续扩展保留合理结构

第一阶段有意控制范围，不追求一开始就做“大而全”。

---

## 为什么要做这个仓库？

很多流媒体项目一上来就做得很重：

- 多协议
- 管理后台
- 鉴权
- 上游复用
- 仪表盘
- 复杂部署系统

这个仓库选择相反的路径。

第一阶段先把**一条 bridge 主链路**做到：

- 能运行
- 可观察
- 可恢复
- 可清理
- 结构清楚

这样后续做：

- shared upstream
- 其他 bridge
- 指标与监控
- 管理能力

才有更稳的基础。

---

## 当前状态

| 模块                        | 状态     |
| --------------------------- | -------- |
| Monorepo 基础设施           | 已完成   |
| Express 服务                | 已完成   |
| WebSocket 路由 `/live/:id`  | 已完成   |
| FFmpeg session 生命周期     | 已完成   |
| FFmpeg 异常退出自动重启骨架 | 已完成   |
| 长时间无数据恢复骨架        | 已完成   |
| `/healthz` 运行态输出       | 已完成   |
| shared upstream             | 暂未实现 |
| 鉴权                        | 暂未实现 |
| 前端播放器 app              | 暂未实现 |
| 其他协议 bridge             | 暂未实现 |

---

## 特性亮点

### 以 bridge 主链路为中心的结构设计

当前 app 的职责分层比较明确：

- route 层负责 websocket 接入和参数校验
- stream manager 负责 session 编排
- ffmpeg session 负责子进程生命周期
- health 路由负责运行态输出

### 先把恢复能力做进来

当前已经有的稳定性能力包括：

- FFmpeg 非主动退出自动重启
- 主动 stop 不自动重启
- 无数据输出时的 idle recovery
- websocket 断开后的 session 清理
- 最大重启次数保护，避免无限重试

### 早期就具备可观测性

当前项目已经具备：

- 围绕 stream 生命周期的结构化日志
- `streamId / sessionId / pid / reason` 统一字段
- `/healthz` 暴露 bridge 运行态
- 使用环境变量控制恢复参数

---

## 第一阶段范围

### 当前范围内

- `rtsp-ws-bridge`
- RTSP 输入
- WebSocket-FLV 输出
- 基于 FFmpeg 的 bridge 进程
- session 生命周期管理
- 健康检查与运行态输出
- 适合 Docker / PM2 的服务结构

### 当前范围外

- shared upstream 复用
- 前端播放器应用
- 鉴权系统
- 管理后台
- 数据库
- Kubernetes 配置
- 超出 RTSP → WS-FLV 之外的协议扩展

---

## 仓库结构

```text
.
├─ apps
│  └─ rtsp-ws-bridge
├─ packages
│  ├─ config
│  ├─ logger
│  ├─ shared
│  ├─ eslint-config
│  └─ typescript-config
├─ docs
├─ .github
└─ ...
```

当前阶段主应用：

- `apps/rtsp-ws-bridge`

---

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备环境变量

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

---

## WebSocket 使用说明

### 连通性诊断路由

先用这个路由做基础 websocket 验证：

```text
ws://localhost:3000/ws-ping
```

预期行为：

- websocket 升级成功
- 服务端返回初始化 JSON
- 发送 `hello` 后收到 echo 响应

### Live 路由

#### 方式一：直接传 RTSP URL

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

#### 方式二：使用 RTSP 模板映射

当配置：

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

即可直接连接：

```text
ws://localhost:3000/live/camera-01
```

服务端会：

- 校验 `:id`
- 解析 RTSP 源地址
- 创建或复用受管 session
- 挂接 websocket client
- 在需要时启动 FFmpeg 生命周期

---

## 最小本地验证

### 检查健康检查接口

```bash
curl http://localhost:3000/healthz
```

### 检查基础 websocket 连通性

```text
ws://localhost:3000/ws-ping
```

### 检查 live 路由

```text
ws://localhost:3000/live/test?url=rtsp://example.com/live.sdp
```

### 再次查看运行态

再次请求 `/healthz`，确认：

- active session 数
- session 快照
- sweep 状态
- restart / idle 相关时间戳

---

## 环境变量

示例：

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

### 关键变量说明

- `HOST`：服务监听地址
- `PORT`：服务监听端口
- `LOG_LEVEL`：日志级别
- `RTSP_URL_TEMPLATE`：未传 `?url=` 时的 RTSP 模板
- `FFMPEG_PATH`：ffmpeg 可执行文件路径
- `STREAM_IDLE_TIMEOUT_MS`：无数据超时阈值
- `STREAM_RESTART_DELAY_MS`：异常退出后的重启延迟
- `STREAM_MAX_RESTARTS`：最大自动重启次数
- `STREAM_SWEEP_INTERVAL_MS`：session 巡检周期

---

## 恢复策略

当前恢复行为采用**明确、保守、可追踪**的设计，不追求一开始就把运行时做得过于复杂。

在当前阶段，项目会把 **FFmpeg 进程重启** 与 **Session 销毁** 视为两类不同的生命周期操作，不将二者混为一体。

### Session 生命周期语义

#### 1. 手动停止（manual stop）

手动停止表示显式终止当前 session。

行为约定：

- 停止当前 FFmpeg 进程
- 禁止后续自动重启
- 清理并解绑当前 session 下的所有 websocket client
- 允许该 session 进入 teardown / destroy 流程

典型场景：

- 最后一个 websocket client 断开后，服务端决定释放资源
- 服务端显式终止当前流 session

#### 2. 恢复性重启（recovery restart）

恢复性重启表示 session 仍然有效，但为了恢复媒体输出，需要重启 FFmpeg 进程。

行为约定：

- 停止旧的 FFmpeg 进程
- 保留当前已挂接的 websocket client
- 在旧进程退出后重新拉起新的 FFmpeg 进程
- 不销毁当前 session
- 尽量对已连接客户端保持透明

典型场景：

- stdout 长时间没有数据，触发 idle recovery
- 需要恢复推流，但不能丢失 client 与 session 的关系

#### 3. 非预期退出后的重启（unexpected-exit restart）

非预期退出后的重启表示 FFmpeg 子进程异常退出后，bridge 根据重启策略尝试恢复。

行为约定：

- 保留当前已连接的 websocket client
- 按配置的重启策略尝试自动拉起 FFmpeg
- 达到最大重启次数后，将 session 标记为 `errored`
- 不等同于手动停止
- session 是否最终销毁，仍由 `StreamManager` 根据剩余 client 决定

典型场景：

- FFmpeg 子进程异常退出
- 上游流短暂异常导致 bridge 进程退出

#### 4. Session 销毁（session destroy）

Session 销毁由 `StreamManager` 统一负责。

行为约定：

- 只有在 **没有 websocket client 剩余** 时，才允许销毁 session
- 仍有客户端连接时，不应销毁 session
- idle recovery / restart 期间，不应因为进程重启而误销毁活跃 session

### 当前恢复规则

当前阶段遵循以下规则：

- **FFmpeg 非预期退出会触发重启**
- **主动 stop 不会触发重启**
- **长时间无数据会触发基于 restart 的恢复**
- **恢复流程应尽量保留已有 websocket client**
- **只有在没有 websocket client 时才允许销毁 session**
- **达到最大重启次数后停止继续自动拉起**

这套策略足够支撑第一阶段“先稳定、后扩展”的目标，同时保证生命周期边界更清晰，便于后续继续扩展 shared upstream、鉴权、监控与更多 bridge 能力。

---

## 健康检查与可观测性

### `GET /healthz`

`/healthz` 不只是静态存活检查，它还会输出 bridge 运行态，例如：

- 服务与运行时元信息
- 生效配置摘要
- active session 数
- sweep 状态
- session 快照列表

### 日志

当前关键生命周期日志包括：

- websocket connect / disconnect
- session create / destroy
- ffmpeg start / exit / restart
- idle recovery

主要日志字段统一围绕：

- `streamId`
- `sessionId`
- `pid`
- `reason`

这样可以把一条 stream 链路从接入追踪到清理。

---

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

Windows 下也可以直接配置：

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

### live 路由能连上，但没有媒体输出

常见原因包括：

- RTSP 地址无效
- ffmpeg 无法访问源
- 源可访问但没有数据输出
- 本地测试用的是占位地址

建议结合以下信息排查：

- `/healthz`
- ffmpeg stderr 日志
- restart / idle recovery 日志

---

## 当前限制

第一阶段**不实现 shared upstream**。

这意味着：

- 同一路 RTSP 的上游复用能力不属于当前阶段
- 当前重点仍是链路正确性、资源清理和生命周期稳定
- shared upstream 会在后续阶段独立推进

当前暂不纳入的还包括：

- 鉴权
- 前端播放器
- 管理后台
- 数据库
- k8s 配置
- 多协议扩展

---

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

同时建议配合使用：

- Labels
- Milestones
- Project Board

---

## 常用命令

### 启动开发服务

```bash
pnpm dev:rtsp-ws-bridge
```

### Lint

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

### Typecheck

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
```

### Build

```bash
pnpm build
```

---

## 后续路线

后续阶段可能扩展到：

- shared upstream
- RTMP / HLS / WebRTC / MPEG-TS bridge
- 鉴权
- 指标与监控
- 管理界面
