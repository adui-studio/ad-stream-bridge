import type { Application, Request, Response } from 'express';
import { env } from '../config/env.js';
import { streamManager } from '../bridges/rtsp-ws/stream-manager.js';

export interface HealthRouteStreamManagerLike {
  getAllSessionSnapshots(): unknown[];
  getRuntimeStats(): {
    activeSessionCount: number;
    activeUpstreamCount: number;
    totalClientCount: number;
    idleTimeoutMs: number;
    sweepIntervalMs: number;
    lastSweepAt: number | null;
    upstreams: unknown[];
  };
}

export function registerHealthRoutes(
  app: Application,
  options?: {
    streamManager?: HealthRouteStreamManagerLike;
  }
): void {
  const manager = options?.streamManager ?? streamManager;

  app.get('/healthz', (_req: Request, res: Response) => {
    const sessions = manager.getAllSessionSnapshots();
    const runtime = manager.getRuntimeStats();

    res.status(200).json({
      ok: true,
      service: 'rtsp-ws-bridge',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        nodeEnv: env.nodeEnv
      },
      config: {
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
      bridge: {
        activeSessionCount: runtime.activeSessionCount,
        activeUpstreamCount: runtime.activeUpstreamCount,
        totalClientCount: runtime.totalClientCount,
        idleTimeoutMs: runtime.idleTimeoutMs,
        sweepIntervalMs: runtime.sweepIntervalMs,
        lastSweepAt: runtime.lastSweepAt
      },
      upstreams: runtime.upstreams,
      sessions
    });
  });
}
