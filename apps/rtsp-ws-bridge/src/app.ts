import express, { type Application, type Request, type Response } from 'express';
import { env } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { registerHealthRoutes } from './routes/health.js';

function isDebugRoutesEnabled(): boolean {
  const value = process.env.ENABLE_DEBUG_ROUTES?.trim().toLowerCase();

  if (!value) {
    return false;
  }

  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.liveAccess.proxy.trustProxyHops);
  app.use(express.json());
  app.use(requestLogger);

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      message: 'rtsp-ws-bridge is running',
      timestamp: new Date().toISOString()
    });
  });

  if (isDebugRoutesEnabled()) {
    app.get('/error-test', () => {
      throw new Error('intentional test error');
    });
  }

  registerHealthRoutes(app);

  return app;
}
