# 部署说明

## 概述

第一阶段的部署目标不是覆盖所有平台，而是优先支持以下场景：

- 本地开发运行
- PM2 运行
- Docker 运行

部署策略以简单、清晰、可观测为优先。

## 环境要求

建议至少满足：

- Node.js 24+
- pnpm
- ffmpeg 可执行文件可用
- 可访问的 RTSP 上游（如果需要实际联调）

## 本地运行

在仓库根目录执行：

```bash
pnpm install
pnpm dev:rtsp-ws-bridge
```

并确保：

- `.env` 已正确准备
- `FFMPEG_PATH` 可用
- 端口未被占用

## PM2

当前代码结构适合后续接入 PM2 做常驻进程管理。

部署时建议：

- 使用明确的 `.env`
- 将日志输出收集到统一位置
- 通过 `/healthz` 做基础健康检查
- 配合 PM2 观察异常退出与重启行为

## Docker

当前项目也适合打包为 Docker 容器。

容器内需要重点确认：

- ffmpeg 已安装
- `FFMPEG_PATH` 正确
- 容器网络可以访问 RTSP 上游
- 健康检查可通过 `/healthz` 暴露

## 健康检查建议

部署环境中建议至少使用：

- `GET /healthz`

来确认：

- 服务进程存活
- 配置已加载
- active session / sweep 正常
- session 状态可观察

## 生产配置建议

生产环境建议：

- 显式配置 `.env`
- 显式配置 `FFMPEG_PATH`
- 不要依赖模糊 PATH 行为
- 合理设置 restart / idle 参数
- 建立日志采集机制
- 观察 FFmpeg stderr 和 restart logs

## 当前不覆盖内容

当前文档不覆盖：

- Kubernetes
- Helm
- metrics backend
- 分布式 session 协调
- 管理平台接入

这些都不属于第一阶段部署范围。
