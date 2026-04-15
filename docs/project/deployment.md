# 部署与运行

本文档说明 `ad-stream-bridge` 在当前 Phase 1 阶段的本地运行、Docker 运行、Docker Compose 联调与常见问题排查方式。

## 适用范围

当前文档适用于以下范围：

- app：`rtsp-ws-bridge`
- 数据流：`RTSP 输入 -> WebSocket-FLV 输出`
- shared upstream 基础能力
- `/healthz` upstream 运行态输出

当前尚未实现：

- 鉴权
- 管理后台
- 多协议 bridge
- 前端播放器 app

因此，本文档默认基于“单 bridge、单服务、单容器”的运行模型。

## 一、本地运行

### 1. 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 2. 准备环境变量

复制 `.env.example` 为 `.env`，并按实际环境修改配置。

Linux / macOS：

```bash
cp .env.example .env
```

PowerShell：

```powershell
Copy-Item .env.example .env
```

### 3. 启动开发环境

```bash
pnpm dev:rtsp-ws-bridge
```

默认地址：

- HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

### 4. 构建项目

```bash
pnpm build
```

## 二、CI 校验

仓库中的 GitHub Actions CI 会在 `push` 和 `pull_request` 时自动执行以下校验：

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

本地在提交前建议先手动执行同样的命令，以减少 PR 往返成本。

## 三、Docker 运行

### 1. 构建镜像

```bash
docker build -t ad-stream-bridge .
```

### 2. 运行容器

```bash
docker run --rm -p 3000:3000 --env-file .env ad-stream-bridge
```

### 3. 验证健康状态

```bash
curl http://localhost:3000/healthz
```

如果在 Windows PowerShell 中执行，可使用：

```powershell
Invoke-WebRequest http://localhost:3000/healthz
```

## 四、Docker Compose 本地联调

### 1. 启动

```bash
docker compose up --build
```

### 2. 后台启动

```bash
docker compose up --build -d
```

### 3. 查看状态

```bash
docker compose ps
```

### 4. 查看日志

```bash
docker compose logs -f
```

### 5. 停止并清理

```bash
docker compose down
```

## 五、推荐验证流程

建议每次变更后至少执行以下验证：

### 1. 工程校验

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### 2. 容器构建校验

```bash
docker build -t ad-stream-bridge .
```

### 3. 容器运行校验

```bash
docker compose up --build -d
curl http://localhost:3000/healthz
docker compose logs --tail=200
```

### 4. Shared Upstream 校验

至少验证一组“相同 upstream”连接：

- 两个客户端连接同一路 RTSP 上游
- 查看 `/healthz`

预期：

- `bridge.activeUpstreamCount = 1`
- `bridge.totalClientCount = 2`
- `upstreams` 中只有一条该 upstream 记录
- 对应 `clientCount = 2`

## 六、环境变量建议

示例：

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

LOG_LEVEL=info

RTSP_URL_TEMPLATE=rtsp://your-rtsp-host/live/{id}
FFMPEG_PATH=ffmpeg

STREAM_IDLE_TIMEOUT_MS=15000
STREAM_RESTART_DELAY_MS=3000
STREAM_MAX_RESTARTS=5
STREAM_SWEEP_INTERVAL_MS=10000
```

### 关键变量说明

- `HOST`：服务监听地址
- `PORT`：服务监听端口
- `LOG_LEVEL`：日志级别
- `RTSP_URL_TEMPLATE`：未传 `?url=` 时的 RTSP 模板
- `FFMPEG_PATH`：ffmpeg 可执行文件路径
- `STREAM_IDLE_TIMEOUT_MS`：无数据超时阈值
- `STREAM_RESTART_DELAY_MS`：异常退出后的重启延迟
- `STREAM_MAX_RESTARTS`：最大自动重启次数
- `STREAM_SWEEP_INTERVAL_MS`：session 巡检周期

## 七、运行态观察建议

shared upstream 已启用后，建议通过 `/healthz` 重点观察：

- `bridge.activeSessionCount`
- `bridge.activeUpstreamCount`
- `bridge.totalClientCount`
- `upstreams[*].upstreamKey`
- `upstreams[*].clientCount`
- `upstreams[*].state`
- `upstreams[*].restartCount`

这组字段可用于判断：

- 是否发生上游复用
- 是否存在错误的重复 upstream
- 是否存在 client 未释放
- 恢复逻辑是否异常触发

## 八、常见问题排查

### 1. Docker Hub 拉取基础镜像失败

现象：

- 无法拉取 `node:25-bookworm-slim`
- 报错 `failed to fetch oauth token`

排查方向：

- 执行 `docker login`
- 检查 Docker Desktop 代理配置
- 检查是否需要镜像加速器
- 切换网络环境重试

### 2. Debian 源安装 FFmpeg 失败

现象：

- `apt-get install ffmpeg` 过程中出现 `500`、`502`、`unexpected EOF`

排查方向：

- 重试构建
- 检查网络稳定性
- 必要时调整 Debian 镜像源
- 保留 apt 重试参数

### 3. Husky 导致生产镜像安装失败

现象：

- `pnpm install --prod` 期间触发 `prepare -> husky`
- 报错 `husky: not found`

处理方式：

- 在运行镜像中禁用 install scripts
- 或确保 husky 不在生产安装阶段触发

### 4. 容器启动后 `/healthz` 不可用

排查方向：

- 检查容器日志 `docker compose logs -f`
- 检查 `.env` 是否缺失或配置错误
- 检查应用是否监听 `0.0.0.0:3000`
- 检查宿主机端口占用

### 5. shared upstream 未按预期复用

排查方向：

- 检查两个客户端连接的最终 RTSP 地址是否完全等价
- 检查是否使用了不同的 `?url=`
- 检查 `/healthz.upstreams` 中的 `upstreamKey`
- 检查是否因 URL 差异导致生成多个 upstreamKey

### 6. RTSP 拉流失败

排查方向：

- 检查 RTSP 地址是否可达
- 检查目标摄像头/流媒体服务是否可访问
- 检查容器网络与防火墙
- 检查 FFmpeg 可执行路径配置是否正确

## 九、当前限制

当前部署文档只覆盖 Phase 1 基线。

当前尚未实现：

- 鉴权
- 多协议输出
- 管理后台
- 前端播放器
- Kubernetes

如果后续实现以上能力，应再单独扩展部署文档。
