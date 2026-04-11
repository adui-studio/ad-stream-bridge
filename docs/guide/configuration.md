# 配置说明

## 概述

本页说明 `rtsp-ws-bridge` 当前阶段涉及的核心运行时配置，以及默认值与回退规则。

第一阶段目标不是做一个复杂配置系统，而是先把运行时关键参数收口到统一入口，避免配置散落在业务代码中。

## 配置总览

当前 app 和 bridge 层统一从环境变量模块读取配置，主要分为四类：

- App runtime
- RTSP source resolution
- FFmpeg
- Recovery controls

## App Runtime

### `NODE_ENV`

运行环境标识，常见值：

- `development`
- `test`
- `production`

默认值：

```env
NODE_ENV=development
```

### `HOST`

服务监听地址。

默认值：

```env
HOST=0.0.0.0
```

### `PORT`

服务监听端口。

默认值：

```env
PORT=3000
```

如果值不是合法数字，或者小于最小允许值，则会自动回退到默认值。

### `LOG_LEVEL`

日志级别。

建议值：

- `debug`
- `info`
- `warn`
- `error`

默认值：

```env
LOG_LEVEL=info
```

## RTSP Source Resolution

### `RTSP_URL_TEMPLATE`

当客户端连接 `/live/:id` 时，如果没有显式传入 `?url=`，则服务端可以使用该模板解析 RTSP 地址。

例如：

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

那么连接：

```text
ws://localhost:3000/live/camera-01
```

就会被解析为：

```text
rtsp://your-rtsp-host/live/camera-01
```

如果：

- 没有传 `?url=...`
- 且 `RTSP_URL_TEMPLATE` 为空

则无法解析 RTSP 地址，session 初始化会失败。

## FFmpeg

### `FFMPEG_PATH`

FFmpeg 可执行文件路径。

默认值：

```env
FFMPEG_PATH=ffmpeg
```

这意味着服务会优先尝试通过系统 PATH 查找 ffmpeg。

在 Windows 下，推荐在无法识别 PATH 时显式配置绝对路径，例如：

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

## Recovery Controls

### `STREAM_IDLE_TIMEOUT_MS`

无数据超时阈值。

如果 FFmpeg 长时间没有 stdout 数据输出，manager 会认为 session 可能已卡死或无效，并触发恢复逻辑。

示例：

```env
STREAM_IDLE_TIMEOUT_MS=15000
```

### `STREAM_SWEEP_INTERVAL_MS`

session 巡检周期。

manager 会定时 sweep 所有 active sessions，用于检查是否进入 idle 状态。

示例：

```env
STREAM_SWEEP_INTERVAL_MS=10000
```

### `STREAM_RESTART_DELAY_MS`

FFmpeg 非主动退出后的自动重启延迟。

示例：

```env
STREAM_RESTART_DELAY_MS=3000
```

### `STREAM_MAX_RESTARTS`

最大自动重启次数。

示例：

```env
STREAM_MAX_RESTARTS=5
```

当前语义：

- `0` 表示**不自动重试**
- 大于 `0` 表示允许最多重试指定次数

## 默认值与回退规则

当前配置模块具备基础的默认值与数值合法性处理。

### 字符串配置

如果：

- 未设置
- 或值为空字符串

则会回退到默认值。

### 数值配置

如果：

- 不是合法数字
- 小于最小值
- 超过允许范围（如果有限制）

则会回退到默认值。

例如：

```env
PORT=abc
STREAM_MAX_RESTARTS=-1
STREAM_IDLE_TIMEOUT_MS=hello
```

最终会回退为默认配置，而不是让服务进入不确定状态。

## 示例配置

### 本地开发示例

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_SWEEP_INTERVAL_MS=10000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
```

### 使用模板映射的示例

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_SWEEP_INTERVAL_MS=10000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
```

## 配置建议

### 本地调试

建议把以下值调小，便于快速看到恢复行为：

```env
STREAM_IDLE_TIMEOUT_MS=5000
STREAM_SWEEP_INTERVAL_MS=2000
STREAM_RESTART_DELAY_MS=1000
```

### 稳定运行环境

建议：

- 显式配置 `FFMPEG_PATH`
- 为 `RTSP_URL_TEMPLATE` 提供稳定模板或要求客户端显式传 `?url=`
- 不要把 `STREAM_SWEEP_INTERVAL_MS` 设得过小
- 为 `STREAM_MAX_RESTARTS` 保留合理上限，避免无限重试
