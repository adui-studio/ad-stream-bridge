import type { Request } from 'express';
import type expressWs from 'express-ws';
import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';
import { streamManager } from '../bridges/rtsp-ws/stream-manager.js';

const STREAM_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function parseStreamId(rawId: string | string[] | undefined): string | null {
  if (Array.isArray(rawId)) {
    return null;
  }

  if (!rawId) {
    return null;
  }

  const streamId = rawId.trim();

  if (!streamId) {
    return null;
  }

  if (!STREAM_ID_PATTERN.test(streamId)) {
    return null;
  }

  return streamId;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function parseRtspUrl(req: Request): string | undefined {
  const { url } = req.query;

  if (Array.isArray(url)) {
    for (const item of url) {
      const normalized = normalizeString(item);

      if (normalized) {
        return normalized;
      }
    }

    return undefined;
  }

  return normalizeString(url);
}

export function registerLiveRoutes(app: expressWs.Application): void {
  app.ws('/live/:id', (ws: WebSocket, req) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rawId = req.params.id;
    const streamId = parseStreamId(rawId);
    const rtspUrl = parseRtspUrl(req);

    if (!streamId) {
      logger.warn('reject websocket live connection: invalid stream id', {
        route: req.originalUrl,
        rawId,
        clientIp
      });

      ws.close(1008, 'invalid stream id');
      return;
    }

    logger.info('incoming live websocket connection', {
      route: req.originalUrl,
      streamId,
      clientIp,
      hasRtspUrl: Boolean(rtspUrl)
    });

    try {
      streamManager.attachClient({
        streamId,
        ws,
        clientIp,
        rtspUrl
      });
    } catch (error) {
      logger.error('failed to attach websocket client to stream manager', {
        route: req.originalUrl,
        streamId,
        clientIp,
        error
      });

      ws.close(1011, 'failed to initialize live stream session');
    }
  });
}
