# 快速开始

## 概述

本页用于帮助你在本地最小成本启动 `rtsp-ws-bridge`，并完成一次基础验证。

第一阶段当前重点是：

- 启动服务
- 验证 WebSocket 接入
- 验证 `/live/:id` 路由
- 检查 `/healthz` 运行态
- 初步观察 FFmpeg 生命周期与恢复行为

## 前置要求

开始之前，请确认本地环境具备：

- Node.js 24+
- pnpm
- 可用的 ffmpeg 可执行文件
- 一个可测试的 RTSP 地址（可选，但推荐）

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 准备环境变量

从示例文件复制一份本地配置：

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

建议先检查以下关键项：

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
FFMPEG_PATH=ffmpeg
RTSP_URL_TEMPLATE=
STREAM_IDLE_TIMEOUT_MS=15000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
STREAM_SWEEP_INTERVAL_MS=10000
```

如果本机 `ffmpeg` 不在系统 `PATH` 中，请显式配置：

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## 启动服务

在仓库根目录执行：

```bash
pnpm dev:rtsp-ws-bridge
```

默认地址：

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

如果启动成功，控制台应能看到服务启动日志。

## 验证基础 HTTP

先检查服务是否已启动：

```bash
curl http://localhost:3000/
```

再检查健康检查接口：

```bash
curl http://localhost:3000/healthz
```

此时你应该至少看到：

- `ok`
- `service`
- `status`
- `runtime`
- `config`
- `bridge`
- `sessions`

## 验证基础 WebSocket

先使用基础诊断路由：

```text
ws://localhost:3000/ws-ping
```

预期行为：

- WebSocket 能成功建立连接
- 服务端会返回初始化 JSON
- 发送 `hello` 后会收到 echo 响应

这个路由主要用于确认：

- upgrade 正常
- express-ws 注册正常
- 本地测试工具工作正常

## 验证 Live 路由

### 方式一：显式传入 RTSP URL

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

### 方式二：使用 RTSP 模板映射

如果 `.env` 中配置了：

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

则可以直接连接：

```text
ws://localhost:3000/live/camera-01
```

此时服务端会：

1. 校验 `:id`
2. 解析 RTSP 地址
3. 创建或获取对应的 stream session
4. 挂接 websocket client
5. 启动 FFmpeg session 生命周期

## 查看运行态

在建立 live 连接后，再请求一次：

```bash
curl http://localhost:3000/healthz
```

重点观察这些字段：

### `bridge`

- `activeSessionCount`
- `idleTimeoutMs`
- `sweepIntervalMs`
- `lastSweepAt`

### `sessions`

每个 session 快照中至少应包含：

- `streamId`
- `sessionId`
- `state`
- `pid`
- `clientCount`
- `restartCount`
- `lastRestartAt`
- `lastStartedAt`
- `lastStoppedAt`
- `lastDataAt`
- `lastErrorAt`
- `lastExitCode`
- `lastExitSignal`

## 最小调试路径建议

推荐按下面顺序验证：

1. `GET /`
2. `GET /healthz`
3. `WS /ws-ping`
4. `WS /live/:id`
5. 再次 `GET /healthz`
6. 观察日志中的 session create / start / exit / restart / destroy

## 调试路由说明

当前项目中，像 `/error-test` 这类仅用于调试的路由，**默认不会在运行时注册**。

这样做的目的，是避免在常规开发、演示或部署环境中无意暴露错误注入入口。

### 默认行为

默认情况下：

- `/error-test` 不可访问
- 请求该路径应返回 `404`
- 常规运行路径中不应包含仅用于调试的测试路由

### 如何显式开启

如果确实需要验证错误处理中间件或调试错误链路，可以通过环境变量显式开启：

```env
ENABLE_DEBUG_ROUTES=true
```

例如：

```bash
ENABLE_DEBUG_ROUTES=true pnpm dev:rtsp-ws-bridge
```

开启后，`/error-test` 会被注册，用于主动触发测试错误。

### 注意事项

- 该能力仅用于本地调试或受控开发环境
- 不建议在常规运行环境中开启
- 不应将 debug route 作为业务功能或外部依赖的一部分

## 常见启动问题

### `spawn ffmpeg ENOENT`

说明本机找不到 ffmpeg：

- 未安装 ffmpeg
- ffmpeg 不在 PATH 中
- `FFMPEG_PATH` 配置错误

先检查：

```bash
ffmpeg -version
```

### `.env` 未生效

请确认：

- `.env` 在仓库根目录
- dev 脚本读取的是根目录 `.env`
- 当前运行方式是从 monorepo 根目录启动

### `/live/:id` 能连上但没有媒体输出

常见原因：

- RTSP URL 无效
- ffmpeg 无法访问上游
- 上游可访问但没有可输出数据
- 当前测试地址只是占位地址

建议结合以下信息排查：

- `/healthz`
- ffmpeg stderr 日志
- restart / idle recovery 日志
