import type { Application, Request, Response } from 'express';
import { env } from '../config/env.js';
import { streamManager } from '../bridges/rtsp-ws/stream-manager.js';

export function registerHealthRoutes(app: Application): void {
  app.get('/healthz', (_req: Request, res: Response) => {
    const snapshots = streamManager.getAllSessionSnapshots();
    const runtime = streamManager.getRuntimeStats();

    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      env: {
        nodeEnv: env.nodeEnv,
        host: env.host,
        port: env.port,
        logLevel: env.logLevel,
        ffmpegPath: env.ffmpegPath,
        rtspUrlTemplate: env.rtspUrlTemplate,
        streamRestartDelayMs: env.streamRestartDelayMs,
        streamMaxRestarts: env.streamMaxRestarts,
        streamIdleTimeoutMs: env.streamIdleTimeoutMs,
        streamSweepIntervalMs: env.streamSweepIntervalMs
      },
      activeSessionCount: runtime.activeSessionCount,
      idleTimeoutMs: runtime.idleTimeoutMs,
      sweepIntervalMs: runtime.sweepIntervalMs,
      lastSweepAt: runtime.lastSweepAt,
      sessions: snapshots
    });
  });
}
