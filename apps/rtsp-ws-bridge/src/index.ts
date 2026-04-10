import { logger } from '@adui/logger';
import { createApp } from './app.js';

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;

function getPort(): number {
  const raw = process.env.PORT;

  if (!raw) {
    return DEFAULT_PORT;
  }

  const parsed = Number(raw);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PORT;
  }

  return parsed;
}

function getHost(): string {
  return process.env.HOST || DEFAULT_HOST;
}

async function bootstrap(): Promise<void> {
  const app = createApp();
  const port = getPort();
  const host = getHost();

  app.listen(port, host, () => {
    logger.info('rtsp-ws-bridge started', {
      host,
      port,
      nodeEnv: process.env.NODE_ENV || 'development'
    });
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('failed to bootstrap rtsp-ws-bridge', {
    error
  });

  process.exit(1);
});
