# 恢复策略

## 概述

本页说明当前阶段的基础恢复策略设计。

第一阶段恢复策略的目标不是复杂，而是**明确、可观察、可调试、可验证**：

- FFmpeg 非主动退出时会尝试自动重启
- 主动 stop 不会触发自动重启
- 长时间无数据输出会触发恢复
- 恢复过程中尽量保留当前 websocket client
- 达到最大重启次数后停止继续自动拉起
- 只有在没有 client 时才允许销毁 session

当前阶段会明确区分两类操作：

- **FFmpeg 进程重启**
- **Session 销毁**

这两者不是同一个动作，不能混为一体。

## 目标

当前恢复策略主要解决以下问题：

- FFmpeg 进程意外退出
- RTSP 上游不可用导致 session 失效
- FFmpeg 进程仍在但长时间没有数据输出
- 无控制的无限重试
- 恢复流程中误清理 websocket client
- 进程重启时误销毁仍在服务中的 session

## Session 生命周期边界

### 1. recovery restart 不等于 session destroy

当 session 触发恢复性重启时：

- 旧的 FFmpeg 进程会被停止
- 在旧进程退出后重新拉起新的 FFmpeg 进程
- 当前已连接的 websocket client 会被保留
- 当前 session 不会因为 restart 而被销毁

也就是说，restart 的目标是恢复推流能力，而不是结束 session。

### 2. manual stop 才会清理 client

当 session 被显式停止时：

- 停止 FFmpeg 进程
- 禁止后续自动重启
- 清理并解绑当前 session 下的 websocket client
- 允许 session 进入最终清理流程

这类行为表示“当前 session 已经被逻辑上结束”。

### 3. session destroy 由 StreamManager 决定

session 是否销毁，不由 FFmpeg 进程退出本身决定，而由 `StreamManager` 统一决策。

当前阶段的规则是：

- 只有在 **没有 websocket client 剩余** 时，才允许销毁 session
- 如果仍有 client，session 不应被 destroy
- idle recovery / restart 期间，不应误销毁活跃 session

这意味着：

- **进程退出 != session 结束**
- **进程重启 != session 销毁**

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

当前语义下，自动重启默认会：

- 尽量保留当前 websocket client
- 恢复 FFmpeg 推流能力
- 不主动销毁 session

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

同时，manual stop 允许：

- 清理 websocket client 绑定关系
- 将 session 推入最终清理流程

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
- `restart()` 只负责恢复 FFmpeg 进程
- recovery 期间默认保留当前 websocket client
- restart 不负责销毁 session

这样可以复用当前已有的 restart 生命周期，而不需要额外引入第二套恢复状态机。

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

注意：

- 达到最大重启次数后，session 会进入 `errored`
- 但这并不自动等于“立刻 destroy”
- 是否最终清理，仍由 `StreamManager` 基于 client 数量和运行时清理路径决定

## 相关配置

恢复相关的主要环境变量有：

- `STREAM_IDLE_TIMEOUT_MS`
- `STREAM_SWEEP_INTERVAL_MS`
- `STREAM_RESTART_DELAY_MS`
- `STREAM_MAX_RESTARTS`

这些变量建议根据环境区别配置：

### 本地调试

建议较小值，方便验证恢复行为，例如：

- 更短的 idle timeout
- 更短的 restart delay
- 较小的 max restart 次数

### 生产环境

建议较稳妥值，避免过于敏感导致误恢复，例如：

- 更保守的 idle timeout
- 更合理的重启间隔
- 有上限的自动恢复次数

## 当前限制

当前阶段恢复策略仍有意保持简化，不做以下内容：

- 复杂 backoff
- 滚动窗口重试统计
- 多级恢复策略
- shared upstream 级别恢复
- 与 metrics / alerting 平台的直接打通
- 多种恢复优先级编排
- 更复杂的 session 状态机

当前阶段优先保证的是：

- 生命周期边界清晰
- websocket client 不被误清理
- manager 清理职责明确
- 恢复路径可追踪、可调试

## 调试建议

当怀疑恢复逻辑有问题时，建议按下面顺序排查：

1. 看 `/healthz`
2. 看 session 快照中的 `state / restartCount / lastRestartAt / lastDataAt`
3. 看 FFmpeg stderr 日志
4. 看 session exit / restart / idle recovery 日志
5. 检查 RTSP 地址是否真实可用
6. 确认当前 session 是否仍有 websocket client
7. 确认是否误触发了 destroy 路径

推荐重点关注的日志字段：

- `streamId`
- `sessionId`
- `pid`
- `reason`

如果问题集中在“恢复后客户端仍收不到数据”，优先检查：

- restart 后 client 是否仍在 session 中
- FFmpeg 是否在旧进程退出后成功重启
- `lastDataAt` 是否继续更新
- `clientCount` 是否在恢复期间被意外清零

## 本地测试与验证

为了保证当前阶段的恢复策略可以稳定迭代，`rtsp-ws-bridge` 已经补充了生命周期相关回归测试。

这些测试的目标不是验证 FFmpeg 编码能力本身，而是优先保护以下行为：

- FFmpeg session 生命周期正确性
- restart / recovery 语义是否正确
- websocket client 是否被正确保留或清理
- stream manager 的 session 编排行为
- `/healthz` 运行态输出结构是否稳定

### 当前测试方式

当前测试采用以下方案：

- Node 内置测试运行器：`node:test`
- TypeScript 运行方式：`tsx`
- 测试目录：`apps/rtsp-ws-bridge/test/`

这样做的原因是：

- 不额外引入重量级测试框架
- 与当前仓库的 TypeScript / Node 运行方式兼容
- 足够支撑第一阶段的生命周期回归测试需求
- 后续可以在此基础上继续扩展

### 常用命令

运行 `rtsp-ws-bridge` 全部测试：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge test
```

运行类型检查：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
```

运行 lint：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

构建应用：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge build
```

### 推荐执行顺序

建议每次提交前至少执行一次：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge test
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge typecheck
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge lint
```

如果本次改动涉及运行时逻辑，再补一次：

```bash
pnpm --filter @ad-stream-bridge/rtsp-ws-bridge build
```

### 当前测试覆盖说明

#### `ffmpeg-session.lifecycle.test.ts`

主要覆盖：

- recovery restart 是否保留 websocket client
- manual stop 是否清理 websocket client
- unexpected exit 是否触发自动重启
- 达到最大重启次数后是否进入 `errored`

#### `stream-manager.lifecycle.test.ts`

主要覆盖：

- 首个 client attach 时是否触发 session start
- 同一 stream 的多个 client 是否复用同一个 session
- 最后一个 client 断开时是否触发 stop + destroy
- websocket error 路径是否会触发 cleanup

#### `stream-manager.idle-recovery.test.ts`

主要覆盖：

- idle timeout 是否触发 restart
- 没有 client 时是否走 destroy 而不是 restart
- 非 `running` 状态下是否不会误触发 idle recovery

#### `health-route.test.ts`

主要覆盖：

- `/healthz` 是否返回 200
- 顶层字段结构是否完整
- `bridge` / `sessions` 结构是否稳定
- `streamManager` 数据是否正确透传到响应中

### 调试建议

如果测试失败，建议按下面顺序排查：

1. 先确认是测试本身失败，还是运行时代码行为已变更
2. 如果是 session 生命周期测试失败，重点看：
   - `state`
   - `restartCount`
   - `lastRestartAt`
   - `lastStartedAt`
   - `lastStoppedAt`
   - `lastDataAt`
   - `clientCount`
3. 如果是 manager 测试失败，重点确认：
   - session 是否被重复创建
   - `start()` 是否被重复调用
   - `stop()` 是否只在无 client 时触发
   - websocket `close` / `error` 是否走到了 cleanup 路径
4. 如果是 `/healthz` 测试失败，重点确认：
   - route 是否已注册
   - `streamManager.getRuntimeStats()` 返回结构是否变化
   - `streamManager.getAllSessionSnapshots()` 是否返回可序列化数据

### 说明

当前测试更偏向“生命周期语义回归保护”，而不是“真实 RTSP / FFmpeg 外部环境验证”。

也就是说：

- 测试负责保护逻辑边界
- 本地真实 RTSP 源验证负责确认外部依赖行为

两者都重要，但职责不同，不应混为一体。
