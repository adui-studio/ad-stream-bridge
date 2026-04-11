# 架构说明

## 设计目标

第一阶段的架构目标很明确：

- 跑通 RTSP → WebSocket-FLV 主链路
- 保证基础生命周期正确性
- 保证基础恢复能力
- 让运行态足够可观察
- 为后续能力扩展预留结构空间

## 当前范围

当前架构围绕一个 app 展开：

- `apps/rtsp-ws-bridge`

它关注的是：

- WebSocket live 路由
- stream manager
- ffmpeg session
- health / runtime inspection

## 分层结构

### Route Layer

职责：

- 提供 HTTP / WebSocket 接入点
- 做参数解析与校验
- 在出错时快速拒绝无效请求
- 将 live 连接委托给 stream manager

不负责：

- 直接管理 FFmpeg 子进程
- 直接维护 session 生命周期
- 直接做恢复策略判断

### Stream Manager

职责：

- 创建或获取 session
- 管理 websocket client 与 session 的关系
- 管理 idle sweep
- 在 session 空闲时清理资源
- 触发 idle recovery

它是 route 层与 FFmpeg session 之间的编排层。

### FFmpeg Session

职责：

- 启动 FFmpeg 子进程
- 停止 FFmpeg 子进程
- 异常退出后的重启
- stdout / stderr / exit / error 事件处理
- 将 stdout 数据转发给 websocket client
- 输出 session 运行态快照

它是当前桥接链路中最核心的运行时单元。

## 数据流

当前主链路大致如下：

1. 客户端连接 `WS /live/:id`
2. route 层校验 `:id`
3. route 层解析 `?url=` 或等待模板映射
4. route 层调用 stream manager
5. manager 创建或获取 session
6. manager 挂接 websocket client
7. session 启动 FFmpeg
8. FFmpeg stdout 被转发到 websocket
9. manager 周期 sweep 检查 idle 状态
10. 当最后一个 client 断开时，manager 清理 session

## 为什么暂不做 shared upstream

shared upstream 是一个非常重要但复杂度明显更高的主题。

原因包括：

- upstream 生命周期会独立于单个 websocket client
- 需要 subscriber 管理
- 需要 fan-out 策略
- 需要更细的错误恢复策略
- 需要处理更多资源共享与回收边界

在第一阶段直接引入 shared upstream，会显著放大系统复杂度。

所以当前阶段有意不做它，而是先把：

- 单条 bridge 链路
- session 生命周期
- 恢复与清理
- 运行态输出

做稳。

## 后续扩展方向

当前结构后续可扩展到：

- shared upstream
- 其他 bridge 类型
- auth
- metrics
- admin UI

但这些能力都应建立在当前 phase 1 runtime 基础稳定的前提下。
