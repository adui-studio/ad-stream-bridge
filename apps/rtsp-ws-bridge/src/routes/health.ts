import type { Application, Request, Response } from 'express';
import { streamManager } from '../bridges/rtsp-ws/stream-manager.js';

export function registerHealthRoutes(app: Application): void {
  app.get('/healthz', (_req: Request, res: Response) => {
    const snapshots = streamManager.getAllSessionSnapshots();

    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      activeSessionCount: streamManager.getActiveSessionCount(),
      sessions: snapshots
    });
  });
}
