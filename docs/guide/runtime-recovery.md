# 恢复策略

## 概述

本页说明当前阶段的基础恢复策略设计。

第一阶段恢复策略的目标不是复杂，而是明确、可观察、可调试：

- FFmpeg 非主动退出时会尝试自动重启
- 主动 stop 不会触发自动重启
- 长时间无数据输出会触发恢复
- 达到最大重启次数后停止继续自动拉起

## 目标

当前恢复策略主要解决以下问题：

- FFmpeg 进程意外退出
- RTSP 上游不可用导致 session 失效
- FFmpeg 进程仍在但长时间没有数据输出
- 无控制的无限重试

## 自动重启

当 FFmpeg 非主动退出时，session 会进入自动重启流程。

基本过程：

1. 记录退出信息
2. 判断是否属于 manual stop
3. 如果不是 manual stop，则等待 `STREAM_RESTART_DELAY_MS`
4. 累加 `restartCount`
5. 尝试重新启动 FFmpeg
6. 当达到 `STREAM_MAX_RESTARTS` 后停止继续重试

相关状态字段包括：

- `restartCount`
- `lastRestartAt`
- `lastExitCode`
- `lastExitSignal`

## 手动停止不重启

这是当前阶段的一个关键判定。

如果 session 是由业务侧主动停止，例如：

- 最后一个 websocket client 断开
- stream manager 主动 stop session
- 明确调用 `stop()`

则 FFmpeg 退出后不会再次自动拉起。

这样可以避免：

- 明明业务已经结束，session 却被错误重启
- 无 client 的情况下继续占用资源
- manager 清理链路被重启逻辑干扰

## Idle Recovery

### 背景

有些情况下 FFmpeg 进程不一定直接退出，但上游流已经失效，或者 FFmpeg 已经无法继续产出有效数据。

仅依靠 exit/error 事件，不足以识别这类“活着但没输出”的状态。

### 判定方式

当前 manager 会按 `STREAM_SWEEP_INTERVAL_MS` 周期巡检 active sessions。

如果某个 session 同时满足：

- 仍然有 client
- 当前状态为 `running`
- `lastDataAt` 长时间未更新
- 超过 `STREAM_IDLE_TIMEOUT_MS`

则会被认为处于 idle/stalled 状态。

### 恢复动作

当前阶段采用最简单、最稳妥的策略：

- 直接触发 `restart()`

这样可以复用当前已有的 restart 逻辑，不需要额外引入多层恢复状态机。

## 最大重启次数保护

为了避免无限重试，当前实现增加了最大重启次数保护。

当：

```text
restartCount >= STREAM_MAX_RESTARTS
```

时，session 会：

- 停止继续自动重启
- 将状态置为错误态
- 打出错误日志

这样可以防止：

- 无法恢复的问题持续打满日志
- 无意义地不断创建新进程
- 资源被异常重试耗尽

## 相关配置

恢复相关的主要环境变量有：

- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_SWEEP_INTERVAL_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

这些变量建议根据环境区别配置：

### 本地调试

建议较小值，方便验证恢复行为。

### 生产环境

建议较稳妥值，避免过于敏感导致误恢复。

## 当前限制

当前阶段恢复策略仍有意保持简化，不做以下内容：

- 复杂 backoff
- 滚动窗口重试统计
- 多级恢复策略
- shared upstream 级别恢复
- 与 metrics/alerting 平台的直接打通

## 调试建议

当怀疑恢复逻辑有问题时，建议按下面顺序排查：

1. 看 `/healthz`
2. 看 session 快照中的 `state / restartCount / lastRestartAt / lastDataAt`
3. 看 FFmpeg stderr 日志
4. 看 session exit / restart / idle recovery 日志
5. 检查 RTSP 地址是否真实可用

推荐重点关注的日志字段：

- `streamId`
- `sessionId`
- `pid`
- `reason`
