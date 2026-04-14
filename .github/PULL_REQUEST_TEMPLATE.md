## 概述

请简要说明本次改动解决了什么问题、覆盖了什么范围，以及为什么现在要做这项改动。

## 关联 Issue

- Closes #<Issue 编号>

## 变更类型

- [ ] 功能新增
- [ ] Bug 修复
- [ ] 工程配置
- [ ] 构建与部署支持
- [ ] 文档更新
- [ ] 重构
- [ ] 测试补充

## 主要变更

请按要点列出本次 PR 的主要改动，例如：

- 新增了什么
- 修改了什么
- 删除了什么
- 调整了哪些配置或文档

## 为什么要做这次变更

请说明这次改动的背景、原因，以及它在当前阶段的价值。

## 风险与影响

请说明这次改动可能带来的影响，例如：

- 兼容性影响
- 部署影响
- 配置变更
- 行为变更
- 回滚注意事项

## 验证方式

### 工程校验

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

### Docker / Compose 校验（如适用）

- [ ] `docker build -t ad-stream-bridge .`
- [ ] `docker compose up --build`
- [ ] `GET /healthz` 已验证
- [ ] 已查看运行日志

### 文档校验（如适用）

- [ ] README 已同步
- [ ] docs 已同步
- [ ] 中英文文档已同步
- [ ] 文档链接已检查

## 手动验证步骤

请写出 reviewer 可以直接复现的验证步骤，例如：

1. 准备 `.env`
2. 执行 `pnpm install --frozen-lockfile`
3. 执行 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
4. 执行 `docker build -t ad-stream-bridge .`
5. 执行 `docker compose up --build`
6. 访问 `GET /healthz`
7. 查看日志并确认行为符合预期

## 当前范围确认

请确认本次 PR 没有误把未来规划当作当前已实现能力写入：

- [ ] 未将 `shared upstream` 写成已实现
- [ ] 未将鉴权写成已实现
- [ ] 未将前端播放器写成已实现
- [ ] 未将多协议 bridge 写成已实现

## Checklist

- [ ] 已先创建并关联对应 Issue
- [ ] 分支从 `dev` 拉出
- [ ] PR 目标分支为 `dev`
- [ ] 命名符合规范（feature/fix/chore/docs）
- [ ] 已评估风险与回滚方式
- [ ] 已完成最小验证
