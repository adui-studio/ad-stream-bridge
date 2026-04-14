FROM node:25-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@10.30.3

FROM base AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HUSKY=0
ENV HOST=0.0.0.0
ENV PORT=3000
ENV FFMPEG_PATH=ffmpeg

RUN apt-get update \
  && apt-get install -y --no-install-recommends --fix-missing -o Acquire::Retries=3 ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/apps/rtsp-ws-bridge/dist ./apps/rtsp-ws-bridge/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist

EXPOSE 3000

CMD ["node", "apps/rtsp-ws-bridge/dist/index.js"]
