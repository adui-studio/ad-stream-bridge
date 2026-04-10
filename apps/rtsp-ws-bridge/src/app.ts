import express, { type Application, type Request, type Response } from 'express';
import { logger } from '@adui/logger';
import { requestLogger } from './middleware/request-logger.js';
import { registerHealthRoutes } from './routes/health.js';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
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

  app.get('/error-test', () => {
    throw new Error('intentional test error');
  });

  registerHealthRoutes(app);

  app.use((req: Request, res: Response) => {
    logger.warn('route not found', {
      method: req.method,
      path: req.originalUrl
    });

    res.status(404).json({
      ok: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });

  app.use((error: unknown, req: Request, res: Response) => {
    logger.error('unhandled application error', {
      method: req.method,
      path: req.originalUrl,
      error
    });

    res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: 'Unexpected server error',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}
