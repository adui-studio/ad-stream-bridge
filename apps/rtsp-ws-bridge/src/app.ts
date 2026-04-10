import express, { type Application, type Request, type Response } from 'express';
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

  return app;
}
