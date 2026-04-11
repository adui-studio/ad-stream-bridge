# 路线图

## Phase 1

第一阶段当前重点包括：

- monorepo 基础设施
- `rtsp-ws-bridge`
- `/live/:id` WebSocket 路由
- FFmpeg session 生命周期
- 自动重启骨架
- idle recovery 骨架
- `/healthz` 运行态输出
- 基础文档站

## 近期下一步

在 Phase 1 完成后，比较自然的下一步可能包括：

- shared upstream 设计与实现
- 更明确的 session 复用策略
- 更稳定的部署脚手架
- 更完整的日志/监控接入

## 后续阶段

后续可能扩展：

- shared upstream
- RTMP bridge
- HLS bridge
- WebRTC bridge
- MPEG-TS bridge
- auth
- metrics and monitoring
- admin UI

## 当前暂不纳入

当前明确暂不纳入的包括：

- 前端播放器 app
- 数据库
- k8s 配置
- 过早的多协议大一统方案

当前阶段仍然坚持：

**先把一条 bridge 主链路做稳。**
