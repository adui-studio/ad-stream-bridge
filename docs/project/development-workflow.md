# 研发流程

## 概述

当前仓库采用比较直接、工程化的 GitHub 协作流程。

推荐原则：

- 先建 Issue
- 从 `dev` 拉分支
- PR 先合入 `dev`
- 稳定后再合入 `main`

## 分支策略

推荐分支命名：

- `feature/*`
- `fix/*`
- `chore/*`
- `docs/*`

例如：

- `feature/rtsp-ws-bridge-core-pipeline`
- `fix/ws-route-registration-order`
- `chore/update-eslint-config`
- `docs/update-vitepress-homepage`

## Issue First

开始编码前，建议先建 Issue。

一个合格的 Issue 最好包含：

- 标题
- 类型
- 目标
- 范围
- 验收标准

如果是较大的主题，建议拆成多个可独立完成的小 task。

## PR Flow

推荐流程：

1. 更新本地 `dev`
2. 从 `dev` 拉功能分支
3. 按逻辑拆提交
4. 提 PR 到 `dev`
5. 等待 Review
6. 等待 CI 通过
7. 合并到 `dev`
8. 稳定后再从 `dev` 合并到 `main`

## Labels / Milestones / Project Board

建议配套使用：

### Labels

例如：

- `feature`
- `fix`
- `chore`
- `docs`
- `bridge`
- `rtsp-ws`
- `backend`
- `phase-1`

### Milestones

例如：

- `Phase 1 - rtsp-ws-bridge MVP`

### Project Board

例如：

- Todo
- In Progress
- In Review
- Done

## 本地检查项

在发起 PR 之前，至少确认：

- 服务能正常启动
- `/healthz` 正常返回
- `/ws-ping` 可连接
- `/live/:id` 可连接
- 非法 `id` 被拒绝
- session 能创建和销毁
- lint 通过
- typecheck 通过
- build 通过

## 文档同步要求

任何会影响运行时行为、接口、配置项、恢复策略的改动，都应同步更新文档。

至少保持这些内容一致：

- `README.md`
- `.env.example`
- VitePress 文档站
- `/healthz` 返回结构说明

推荐做法是：

- 代码改动与文档改动放进同一个 PR
- 不把文档更新拖到后面补
