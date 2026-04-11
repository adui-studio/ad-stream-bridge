# API

## 概述

当前阶段的 `rtsp-ws-bridge` 对外提供一组非常小但清晰的 HTTP / WebSocket 接口。

其目标不是覆盖所有控制能力，而是优先支撑：

- 服务存活检查
- 运行态观察
- WebSocket 诊断
- live stream 接入

## HTTP Endpoints

### `GET /`

服务基础存活接口。

返回：

- `ok`
- `service`
- `message`
- `timestamp`

适合做最简单的启动确认。

### `GET /healthz`

运行态健康检查接口。

与根路由不同，`/healthz` 会输出桥接服务当前的基础运行态信息，包括：

- 服务状态
- 运行时信息
- 配置摘要
- active session 数
- sweep 状态
- session 快照列表

适合：

- 本地调试
- 部署后验活
- session 生命周期观察
- 恢复策略验证

## WebSocket Endpoints

### `WS /ws-ping`

用于基础 WebSocket 诊断。

主要作用：

- 验证 upgrade 是否正常
- 验证服务端能否收发消息
- 排除本地工具、路由注册、express-ws 接入问题

示例：

```text
ws://localhost:3000/ws-ping
```

### `WS /live/:id`

当前阶段主 live 路由。

主要职责：

- 校验 `:id`
- 解析 RTSP 源地址
- 创建或获取 managed session
- 挂接 websocket client
- 将后续 FFmpeg 生命周期控制委托给 stream manager

示例：

#### 显式传入 RTSP URL

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

#### 使用 RTSP 模板映射

```text
ws://localhost:3000/live/camera-01
```

前提是：

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

## Path Parameters

### `:id`

必须满足基础格式校验。

当前允许：

- 字母
- 数字
- `_`
- `-`

允许示例：

- `test`
- `camera-01`
- `office_gate_2`

不允许示例：

- `camera 01`
- `camera/01`
- 空字符串

非法 `id` 会被拒绝，并关闭 websocket 连接。

## Query Parameters

### `url`

可选参数，用于显式指定 RTSP 上游地址。

当存在 `url` 时，通常优先使用显式传入地址。
当不存在 `url` 时，才尝试使用 `RTSP_URL_TEMPLATE` 进行地址解析。

## 错误行为

### 非法 `id`

服务会拒绝连接，并返回对应 close 行为。

### 无法解析 RTSP 地址

如果：

- 没有传 `?url=...`
- 且没有配置 `RTSP_URL_TEMPLATE`

则 session 初始化会失败。

### FFmpeg 无法启动

如果：

- `FFMPEG_PATH` 不正确
- 本机找不到 ffmpeg
- 上游地址不可访问

则日志中会出现对应的 FFmpeg 进程错误。

## 说明

当前 API 面向 Phase 1，设计上刻意保持简单：

- 不做复杂控制指令
- 不做 auth
- 不做 shared upstream 暴露
- 不做管理侧 API

当前的重点是让主桥接链路稳定、可观察、可调试。
