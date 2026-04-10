import express, { type Application, type Request, type Response } from 'express';
import { registerHealthRoutes } from './routes/health.js';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      message: 'rtsp-ws-bridge is running',
      timestamp: new Date().toISOString()
    });
  });

  registerHealthRoutes(app);

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });

  app.use((error: unknown, _req: Request, res: Response) => {
    res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  });

  return app;
}
