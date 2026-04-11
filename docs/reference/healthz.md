# Healthz

## 概述

`GET /healthz` 用于返回当前 bridge 服务的基础健康状态与运行态信息。

它不是一个纯静态的 liveness endpoint，而是一个偏运行态摘要的接口。

## 响应结构

当前典型返回包含：

- `ok`
- `service`
- `status`
- `timestamp`
- `uptimeSec`
- `runtime`
- `config`
- `bridge`
- `sessions`

## Runtime Section

`runtime` 反映当前进程与运行时环境，例如：

- `nodeVersion`
- `platform`
- `arch`
- `pid`
- `nodeEnv`

用途：

- 确认运行时版本
- 区分不同部署环境
- 排查环境差异

## Config Section

`config` 反映当前实际生效的关键配置摘要，例如：

- `host`
- `port`
- `logLevel`
- `ffmpegPath`
- `rtspUrlTemplate`
- `streamRestartDelayMs`
- `streamMaxRestarts`
- `streamIdleTimeoutMs`
- `streamSweepIntervalMs`

用途：

- 检查 `.env` 是否生效
- 确认默认值/回退值是否正确
- 排查环境配置问题

## Bridge Section

`bridge` 反映 manager 当前整体运行态，例如：

- `activeSessionCount`
- `idleTimeoutMs`
- `sweepIntervalMs`
- `lastSweepAt`

用途：

- 观察当前是否存在 active session
- 判断 sweep loop 是否在运行
- 判断无数据恢复巡检是否在推进

## Sessions Section

`sessions` 是当前所有 managed session 的快照列表。

每个 session 快照通常包括：

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

## 如何用于调试

推荐在以下场景使用 `/healthz`：

### 1. 启动后验活

确认服务已正常启动，配置已加载。

### 2. Live 路由建立连接后

确认：

- `activeSessionCount` 增加
- 新 session 已出现
- `clientCount` 正常

### 3. 断开连接后

确认：

- session 被清理
- `activeSessionCount` 下降
- idle session 被移除

### 4. 恢复逻辑验证

观察：

- `restartCount`
- `lastRestartAt`
- `lastDataAt`
- `lastExitCode`
- `lastExitSignal`

## 已知限制

当前 `/healthz` 仍是 Phase 1 版本，重点是实用，不追求完整监控体系。

当前不包含：

- Prometheus 指标
- 更细粒度的性能统计
- 历史 session 聚合视图
- 告警与通知集成

它的定位是：

- 当前运行态检查
- 本地调试与部署验收辅助
