import { type Application, type Request, type Response } from 'express';

export function registerHealthRoutes(app: Application): void {
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      uptimeSec: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString()
    });
  });
}
