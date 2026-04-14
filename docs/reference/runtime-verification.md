# 运行验证

本文档用于说明 `rtsp-ws-bridge` 在当前阶段的最小运行验证方式。

## 验证目标

确认以下能力可用：

- 服务能正常启动
- `/healthz` 可访问
- `/ws-ping` 可访问
- `/live/:id` 路由可接入
- 容器化启动流程可工作

## 一、本地工程校验

执行：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

预期结果：

- 所有命令成功退出
- 无阻塞性错误

## 二、Docker 构建验证

执行：

```bash
docker build -t ad-stream-bridge .
```

预期结果：

- 镜像成功构建
- 无依赖安装失败
- 无 Dockerfile 阻塞错误

## 三、Docker Compose 运行验证

执行：

```bash
docker compose up --build -d
docker compose ps
```

预期结果：

- `rtsp-ws-bridge` 容器处于运行状态
- 健康检查最终通过

查看日志：

```bash
docker compose logs -f
```

## 四、HTTP 接口验证

### 1. `/healthz`

```bash
curl http://localhost:3000/healthz
```

预期结果：

- 返回 200
- 返回内容包含当前 bridge 运行状态

### 2. `/ws-ping`

可使用浏览器、WebSocket 客户端或当前项目已有调试方式验证：

```text
ws://localhost:3000/ws-ping
```

预期结果：

- WebSocket 升级成功
- 服务端发送初始化消息
- 基础 echo 或诊断能力正常

## 五、流路由验证

验证路由：

```text
WS /live/:id
```

方式一：直接传 RTSP URL

```text
ws://localhost:3000/live/test?url=rtsp://your-source/live.sdp
```

方式二：使用模板映射

```text
ws://localhost:3000/live/camera-01
```

前提是已配置：

```env
RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
```

建议验证点：

- 连接建立成功
- 无立即断开
- 日志中可看到对应 session 生命周期信息
- 客户端断开后，服务端能完成清理

## 六、异常场景验证

建议至少人工验证以下场景：

- 客户端连接后主动断开
- RTSP 地址不可达
- FFmpeg 异常退出
- 长时间无数据输出后的恢复逻辑
- 容器重启后的服务恢复

## 七、日志观察建议

建议结合以下命令观察运行状态：

```bash
docker compose logs -f
```

重点关注：

- session 创建
- FFmpeg 启动
- FFmpeg 退出
- restart / idle recovery
- WebSocket 断开清理

## 八、测试与验证的边界

当前测试更偏向“生命周期语义回归保护”，而不是“真实 RTSP / FFmpeg 外部环境验证”。

也就是说：

- 自动化测试负责保护逻辑边界
- 本地真实 RTSP 源验证负责确认外部依赖行为

两者都重要，但职责不同，不应混为一体。

## 九、当前不在验证范围内

以下能力当前尚未实现，不应写入当前验证基线：

- shared upstream
- 鉴权
- 多协议输出
- 管理后台
- 前端播放器
