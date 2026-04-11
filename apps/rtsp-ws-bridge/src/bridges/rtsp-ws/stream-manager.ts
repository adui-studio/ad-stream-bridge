import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';
import { FfmpegSession, type FfmpegSessionSnapshot } from './ffmpeg-session.js';

export interface AttachClientInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
}

interface ManagedSession {
  session: FfmpegSession;
  rtspUrl: string;
  createdAt: number;
}

const DEFAULT_RTSP_URL_TEMPLATE = process.env.RTSP_URL_TEMPLATE || '';

function resolveRtspUrl(streamId: string, rtspUrl?: string): string {
  const normalized = rtspUrl?.trim();

  if (normalized) {
    return normalized;
  }

  if (DEFAULT_RTSP_URL_TEMPLATE) {
    return DEFAULT_RTSP_URL_TEMPLATE.replace('{id}', streamId);
  }

  throw new Error(`missing rtsp url for stream ${streamId}`);
}

export class StreamManager {
  private readonly sessions = new Map<string, ManagedSession>();

  attachClient(input: AttachClientInput): void {
    const { streamId, ws, clientIp, rtspUrl } = input;

    const managedSession = this.getOrCreateSession(streamId, rtspUrl);
    const snapshotBeforeAttach = managedSession.session.getSnapshot();

    managedSession.session.attachClient({
      ws,
      clientIp
    });

    const snapshotAfterAttach = managedSession.session.getSnapshot();

    logger.info('stream manager attached websocket client', {
      streamId,
      clientIp,
      clientCount: snapshotAfterAttach.clientCount
    });

    if (snapshotBeforeAttach.clientCount === 0) {
      managedSession.session.start();
    }

    try {
      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          message: 'live websocket connected',
          rtspUrlSource: rtspUrl ? 'query' : DEFAULT_RTSP_URL_TEMPLATE ? 'template' : 'unknown',
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('failed to send live websocket initial message', {
        streamId,
        clientIp,
        error
      });

      managedSession.session.detachClient(ws, 'initial message send failed');
      this.cleanupSessionIfIdle(streamId);
      throw error;
    }

    ws.on('close', (code, reason) => {
      managedSession.session.detachClient(ws, `websocket close (${code}: ${reason.toString()})`);
      this.cleanupSessionIfIdle(streamId);
    });

    ws.on('error', (error) => {
      logger.error('live websocket client error', {
        streamId,
        clientIp,
        error
      });
    });

    ws.on('message', (message) => {
      const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);

      logger.info('live websocket client message received', {
        streamId,
        clientIp,
        payload
      });

      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          message: 'live route does not accept upstream control messages yet',
          timestamp: new Date().toISOString()
        })
      );
    });
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getSessionSnapshot(streamId: string): FfmpegSessionSnapshot | null {
    return this.sessions.get(streamId)?.session.getSnapshot() ?? null;
  }

  getAllSessionSnapshots(): FfmpegSessionSnapshot[] {
    return Array.from(this.sessions.values()).map(({ session }) => session.getSnapshot());
  }

  private getOrCreateSession(streamId: string, rtspUrl?: string): ManagedSession {
    const existing = this.sessions.get(streamId);

    if (existing) {
      return existing;
    }

    const resolvedRtspUrl = resolveRtspUrl(streamId, rtspUrl);

    const session = new FfmpegSession({
      streamId,
      rtspUrl: resolvedRtspUrl
    });

    const managedSession: ManagedSession = {
      session,
      rtspUrl: resolvedRtspUrl,
      createdAt: Date.now()
    };

    this.sessions.set(streamId, managedSession);

    logger.info('stream manager created ffmpeg session', {
      streamId,
      rtspUrl: resolvedRtspUrl
    });

    return managedSession;
  }

  private cleanupSessionIfIdle(streamId: string): void {
    const managedSession = this.sessions.get(streamId);

    if (!managedSession) {
      return;
    }

    const snapshot = managedSession.session.getSnapshot();

    if (snapshot.clientCount > 0) {
      return;
    }

    managedSession.session.stop('no websocket clients remain');
    this.sessions.delete(streamId);

    logger.info('stream manager removed idle ffmpeg session', {
      streamId,
      rtspUrl: managedSession.rtspUrl
    });
  }
}

export const streamManager = new StreamManager();
