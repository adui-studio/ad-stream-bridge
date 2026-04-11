import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';

export interface AttachClientInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
}

interface StreamClient {
  ws: WebSocket;
  clientIp: string;
  connectedAt: number;
}

interface StreamSession {
  streamId: string;
  rtspUrl?: string;
  clients: Set<StreamClient>;
  createdAt: number;
}

export class StreamManager {
  private readonly sessions = new Map<string, StreamSession>();

  attachClient(input: AttachClientInput): void {
    const { streamId, ws, clientIp, rtspUrl } = input;

    let session = this.sessions.get(streamId);

    if (!session) {
      session = {
        streamId,
        rtspUrl,
        clients: new Set<StreamClient>(),
        createdAt: Date.now()
      };

      this.sessions.set(streamId, session);

      logger.info('stream session created', {
        streamId,
        hasRtspUrl: Boolean(rtspUrl)
      });
    } else if (rtspUrl && !session.rtspUrl) {
      session.rtspUrl = rtspUrl;
    }

    const client: StreamClient = {
      ws,
      clientIp,
      connectedAt: Date.now()
    };

    session.clients.add(client);

    logger.info('stream client attached', {
      streamId,
      clientIp,
      clientCount: session.clients.size
    });

    try {
      ws.send(
        JSON.stringify({
          ok: true,
          streamId,
          message: 'live websocket connected',
          hasRtspUrl: Boolean(session.rtspUrl),
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('failed to send live websocket initial message', {
        streamId,
        clientIp,
        error
      });

      session.clients.delete(client);

      if (session.clients.size === 0) {
        this.sessions.delete(streamId);
      }

      throw error;
    }

    ws.on('close', (code, reason) => {
      this.detachClient(streamId, client, code, reason.toString());
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

  private detachClient(streamId: string, client: StreamClient, code: number, reason: string): void {
    const session = this.sessions.get(streamId);

    if (!session) {
      return;
    }

    session.clients.delete(client);

    logger.info('stream client detached', {
      streamId,
      clientIp: client.clientIp,
      code,
      reason,
      clientCount: session.clients.size
    });

    if (session.clients.size === 0) {
      this.sessions.delete(streamId);

      logger.info('stream session removed because no clients remain', {
        streamId
      });
    }
  }
}

export const streamManager = new StreamManager();
