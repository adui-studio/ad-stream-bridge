import expressWs from 'express-ws';
import { logger } from '@adui/logger';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/not-found.js';
import { registerLiveRoutes } from './routes/live.js';
import { registerWsPingRoutes } from './routes/ws-ping.js';

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
  registerLiveRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(env.port, env.host, () => {
    logger.info('rtsp-ws-bridge started', {
      host: env.host,
      port: env.port,
      nodeEnv: env.nodeEnv,
      websocket: true
    });
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('failed to bootstrap rtsp-ws-bridge', { error });
  process.exit(1);
});
