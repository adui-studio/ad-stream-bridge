import type expressWs from 'express-ws';
import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';

export function registerWsPingRoutes(app: expressWs.Application): void {
  app.ws('/ws-ping', (ws: WebSocket, req) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const route = req.originalUrl || req.path || '/ws-ping';

    logger.info('websocket client connected', {
      route,
      clientIp
    });

    try {
      ws.send(
        JSON.stringify({
          ok: true,
          message: 'ws connection established',
          route,
          timestamp: new Date().toISOString()
        })
      );
    } catch (error) {
      logger.error('failed to send initial websocket message', {
        route,
        clientIp,
        error
      });

      ws.close(1011, 'failed to send initial message');
      return;
    }

    ws.on('message', (message) => {
      try {
        const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);

        logger.info('websocket message received', {
          route,
          clientIp,
          payload
        });

        ws.send(
          JSON.stringify({
            ok: true,
            echo: payload,
            route,
            timestamp: new Date().toISOString()
          })
        );
      } catch (error) {
        logger.error('websocket message handling failed', {
          route,
          clientIp,
          error
        });

        ws.close(1011, 'message handling failed');
      }
    });

    ws.on('close', (code, reason) => {
      logger.info('websocket client disconnected', {
        route,
        clientIp,
        code,
        reason: reason.toString()
      });
    });

    ws.on('error', (error) => {
      logger.error('websocket client error', {
        route,
        clientIp,
        error
      });
    });
  });
}
