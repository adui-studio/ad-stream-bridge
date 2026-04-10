import expressWs from 'express-ws';
import { logger } from '@adui/logger';
import { createApp } from './app.js';
import { errorHandler, notFoundHandler } from './middleware/not-found.js';
import { registerWsPingRoutes } from './routes/ws-ping.js';

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

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', { error });
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', { reason });
});

async function bootstrap(): Promise<void> {
  const baseApp = createApp();
  const wsInstance = expressWs(baseApp);
  const app = wsInstance.app;

  registerWsPingRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = getPort();
  const host = getHost();

  app.listen(port, host, () => {
    logger.info('rtsp-ws-bridge started', {
      host,
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      websocket: true
    });
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('failed to bootstrap rtsp-ws-bridge', { error });
  process.exit(1);
});
