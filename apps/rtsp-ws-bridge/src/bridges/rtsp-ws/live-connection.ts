import type { WebSocket } from 'ws';

import type { StreamManager } from './stream-manager.js';

export interface BindLiveConnectionInput {
  streamId: string;
  ws: WebSocket;
  clientIp: string;
  rtspUrl?: string;
  streamManager: StreamManager;
}

export function bindLiveConnection(input: BindLiveConnectionInput): void {
  const { streamId, ws, clientIp, rtspUrl, streamManager } = input;

  const opened = streamManager.openConnection({
    streamId,
    ws,
    clientIp,
    rtspUrl
  });

  try {
    ws.send(
      JSON.stringify({
        ok: true,
        streamId: opened.streamId,
        upstreamKey: opened.upstreamKey,
        message: 'live websocket connected',
        rtspUrlSource: opened.rtspUrlSource,
        timestamp: new Date().toISOString()
      })
    );
  } catch (error) {
    streamManager.closeConnection({
      streamId,
      upstreamKey: opened.upstreamKey,
      ws,
      reason: 'initial_send_failed'
    });

    throw error;
  }

  const cleanup = (reason: string) => {
    streamManager.closeConnection({
      streamId,
      upstreamKey: opened.upstreamKey,
      ws,
      reason
    });
  };

  ws.on('close', (code, reason) => {
    cleanup(`websocket close (${code}: ${reason.toString()})`);
  });

  ws.on('error', (error) => {
    streamManager.reportClientError({
      streamId,
      upstreamKey: opened.upstreamKey,
      clientIp,
      error
    });

    cleanup('websocket error');
  });

  ws.on('message', (message) => {
    const payload = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);

    streamManager.handleClientMessage({
      streamId,
      upstreamKey: opened.upstreamKey,
      clientIp,
      ws,
      payload
    });
  });
}
