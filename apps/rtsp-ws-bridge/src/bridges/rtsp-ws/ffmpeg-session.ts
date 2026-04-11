import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';

export interface FfmpegSessionOptions {
  streamId: string;
  rtspUrl: string;
  ffmpegPath?: string;
  ffmpegArgs?: string[];
  restartDelayMs?: number;
  maxRestarts?: number;
}

export interface SessionClient {
  ws: WebSocket;
  clientIp?: string;
}

export interface FfmpegSessionSnapshot {
  streamId: string;
  rtspUrl: string;
  state: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'errored';
  pid: number | null;
  clientCount: number;
  restartCount: number;
  lastRestartAt: number | null;
  lastStartedAt: number | null;
  lastStoppedAt: number | null;
  lastDataAt: number | null;
  lastErrorAt: number | null;
  lastExitCode: number | null;
  lastExitSignal: NodeJS.Signals | null;
}

interface ClientBinding {
  clientIp?: string;
  closeHandler: () => void;
  errorHandler: (arg0: Error) => void;
}

const DEFAULT_RESTART_DELAY_MS = Number(process.env.STREAM_RESTART_DELAY_MS || 3000);
const DEFAULT_MAX_RESTARTS = Number(process.env.STREAM_MAX_RESTARTS || 5);

export class FfmpegSession {
  private readonly streamId: string;
  private readonly rtspUrl: string;
  private readonly ffmpegPath: string;
  private readonly ffmpegArgs: string[];
  private readonly restartDelayMs: number;
  private readonly maxRestarts: number;

  private child: ChildProcessByStdio<null, Readable, Readable> | null = null;
  private readonly clients = new Set<WebSocket>();
  private readonly clientBindings = new Map<WebSocket, ClientBinding>();

  private state: FfmpegSessionSnapshot['state'] = 'idle';
  private restartCount = 0;
  private lastRestartAt: number | null = null;
  private lastStartedAt: number | null = null;
  private lastStoppedAt: number | null = null;
  private lastDataAt: number | null = null;
  private lastErrorAt: number | null = null;
  private lastExitCode: number | null = null;
  private lastExitSignal: NodeJS.Signals | null = null;

  private shouldRestart = true;
  private restartTimer: NodeJS.Timeout | null = null;
  private stderrBuffer = '';

  constructor(options: FfmpegSessionOptions) {
    this.streamId = options.streamId;
    this.rtspUrl = options.rtspUrl;
    this.ffmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
    this.restartDelayMs = this.normalizeNumber(
      options.restartDelayMs,
      DEFAULT_RESTART_DELAY_MS,
      3000
    );
    this.maxRestarts = this.normalizeNumber(options.maxRestarts, DEFAULT_MAX_RESTARTS, 5);
    this.ffmpegArgs = options.ffmpegArgs ?? this.buildDefaultArgs();
  }

  start(): void {
    if (this.child || this.state === 'starting' || this.state === 'running') {
      logger.warn('ffmpeg session start skipped: already active', {
        streamId: this.streamId,
        state: this.state,
        pid: this.child?.pid ?? null
      });
      return;
    }

    this.clearRestartTimer();
    this.shouldRestart = true;
    this.state = 'starting';
    this.stderrBuffer = '';

    logger.info('starting ffmpeg session', {
      streamId: this.streamId,
      ffmpegPath: this.ffmpegPath,
      ffmpegArgs: this.ffmpegArgs,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt
    });

    const child = spawn(this.ffmpegPath, this.ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.child = child;
    this.lastStartedAt = Date.now();

    child.stdout.on('data', this.handleStdout);
    child.stderr.on('data', this.handleStderr);
    child.on('error', this.handleError);
    child.on('exit', this.handleExit);

    this.state = 'running';

    logger.info('ffmpeg session process spawned', {
      streamId: this.streamId,
      pid: child.pid ?? null,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt
    });
  }

  stop(reason = 'manual stop'): void {
    this.shouldRestart = false;
    this.clearRestartTimer();

    const child = this.child;

    if (!child) {
      this.clearAllClientBindings();
      this.state = 'stopped';
      this.lastStoppedAt = Date.now();

      logger.info('ffmpeg session stop skipped: no active process', {
        streamId: this.streamId,
        reason,
        restartCount: this.restartCount
      });
      return;
    }

    this.state = 'stopping';

    logger.info('stopping ffmpeg session', {
      streamId: this.streamId,
      pid: child.pid ?? null,
      reason,
      shouldRestart: this.shouldRestart,
      restartCount: this.restartCount
    });

    this.removeChildListeners(child);

    try {
      child.kill('SIGTERM');
    } catch (error) {
      this.lastErrorAt = Date.now();

      logger.error('failed to stop ffmpeg session cleanly', {
        streamId: this.streamId,
        pid: child.pid ?? null,
        error
      });
    }

    this.child = null;
    this.clearAllClientBindings();
    this.lastStoppedAt = Date.now();
    this.lastExitCode = null;
    this.lastExitSignal = 'SIGTERM';
    this.state = 'stopped';
  }

  restart(reason = 'manual restart'): void {
    logger.info('restarting ffmpeg session manually', {
      streamId: this.streamId,
      reason,
      restartCount: this.restartCount
    });

    this.stop(reason);
    this.shouldRestart = true;
    this.lastRestartAt = Date.now();
    this.restartCount += 1;
    this.start();
  }

  attachClient(client: SessionClient): void {
    const existingBinding = this.clientBindings.get(client.ws);

    if (existingBinding) {
      logger.warn('ffmpeg session attach skipped: websocket already attached', {
        streamId: this.streamId,
        clientIp: client.clientIp || existingBinding.clientIp || 'unknown',
        clientCount: this.clients.size
      });
      return;
    }

    const closeHandler = () => {
      this.detachClient(client.ws, 'websocket close');
    };

    const errorHandler = (error: Error) => {
      logger.error('ffmpeg session websocket client error', {
        streamId: this.streamId,
        clientIp: client.clientIp || 'unknown',
        error
      });

      this.detachClient(client.ws, 'websocket error');
    };

    client.ws.on('close', closeHandler);
    client.ws.on('error', errorHandler);

    this.clients.add(client.ws);
    this.clientBindings.set(client.ws, {
      clientIp: client.clientIp,
      closeHandler,
      errorHandler
    });

    logger.info('ffmpeg session client attached', {
      streamId: this.streamId,
      clientIp: client.clientIp || 'unknown',
      clientCount: this.clients.size
    });
  }

  detachClient(ws: WebSocket, reason = 'manual detach'): void {
    const binding = this.clientBindings.get(ws);
    const removed = this.clients.delete(ws);

    if (binding) {
      ws.off('close', binding.closeHandler);
      ws.off('error', binding.errorHandler);
      this.clientBindings.delete(ws);
    }

    if (!removed) {
      return;
    }

    logger.info('ffmpeg session client detached', {
      streamId: this.streamId,
      clientIp: binding?.clientIp || 'unknown',
      reason,
      clientCount: this.clients.size
    });
  }

  getSnapshot(): FfmpegSessionSnapshot {
    return {
      streamId: this.streamId,
      rtspUrl: this.rtspUrl,
      state: this.state,
      pid: this.child?.pid ?? null,
      clientCount: this.clients.size,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      lastStartedAt: this.lastStartedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastDataAt: this.lastDataAt,
      lastErrorAt: this.lastErrorAt,
      lastExitCode: this.lastExitCode,
      lastExitSignal: this.lastExitSignal
    };
  }

  private buildDefaultArgs(): string[] {
    return [
      '-rtsp_transport',
      'tcp',
      '-i',
      this.rtspUrl,
      '-f',
      'flv',
      '-an',
      '-c:v',
      'copy',
      'pipe:1'
    ];
  }

  private normalizeNumber(
    value: number | undefined,
    fallback: number,
    finalFallback: number
  ): number {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }

    if (Number.isFinite(fallback) && fallback >= 0) {
      return fallback;
    }

    return finalFallback;
  }

  private readonly handleStdout = (chunk: Buffer): void => {
    this.lastDataAt = Date.now();

    for (const client of this.clients) {
      if (client.readyState !== client.OPEN) {
        continue;
      }

      try {
        client.send(chunk, { binary: true });
      } catch (error) {
        this.lastErrorAt = Date.now();

        logger.error('failed to forward ffmpeg stdout chunk to websocket client', {
          streamId: this.streamId,
          error
        });
      }
    }
  };

  private readonly handleStderr = (chunk: Buffer): void => {
    const text = chunk.toString('utf8');
    this.stderrBuffer += text;

    const lines = this.stderrBuffer.split('\n');
    this.stderrBuffer = lines.pop() || '';

    for (const line of lines) {
      const message = line.trim();

      if (!message) {
        continue;
      }

      logger.warn('ffmpeg stderr output', {
        streamId: this.streamId,
        message
      });
    }
  };

  private readonly handleError = (error: Error): void => {
    this.lastErrorAt = Date.now();
    this.state = 'errored';

    logger.error('ffmpeg session process error', {
      streamId: this.streamId,
      pid: this.child?.pid ?? null,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      error
    });
  };

  private readonly handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    const child = this.child;

    if (child) {
      this.removeChildListeners(child);
    }

    this.child = null;
    this.lastStoppedAt = Date.now();
    this.lastExitCode = code;
    this.lastExitSignal = signal;
    this.state = 'stopped';

    const wasManualStop = !this.shouldRestart;

    logger.warn('ffmpeg session exited', {
      streamId: this.streamId,
      code,
      signal,
      wasManualStop,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts
    });

    if (wasManualStop) {
      logger.info('ffmpeg session exit will not restart because stop was manual', {
        streamId: this.streamId,
        code,
        signal
      });
      return;
    }

    if (this.restartCount >= this.maxRestarts) {
      this.state = 'errored';

      logger.error('ffmpeg session reached max restart limit', {
        streamId: this.streamId,
        restartCount: this.restartCount,
        maxRestarts: this.maxRestarts,
        lastExitCode: this.lastExitCode,
        lastExitSignal: this.lastExitSignal
      });

      return;
    }

    this.restartCount += 1;
    this.lastRestartAt = Date.now();

    logger.warn('ffmpeg session scheduled for restart after unexpected exit', {
      streamId: this.streamId,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      restartDelayMs: this.restartDelayMs,
      lastRestartAt: this.lastRestartAt,
      lastExitCode: this.lastExitCode,
      lastExitSignal: this.lastExitSignal
    });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;

      logger.info('restarting ffmpeg session after unexpected exit', {
        streamId: this.streamId,
        restartCount: this.restartCount,
        maxRestarts: this.maxRestarts,
        restartDelayMs: this.restartDelayMs,
        lastRestartAt: this.lastRestartAt
      });

      this.start();
    }, this.restartDelayMs);
  };

  private removeChildListeners(child: ChildProcessByStdio<null, Readable, Readable>): void {
    child.stdout.off('data', this.handleStdout);
    child.stderr.off('data', this.handleStderr);
    child.off('error', this.handleError);
    child.off('exit', this.handleExit);
  }

  private clearAllClientBindings(): void {
    for (const [ws, binding] of this.clientBindings.entries()) {
      ws.off('close', binding.closeHandler);
      ws.off('error', binding.errorHandler);
    }

    this.clientBindings.clear();
    this.clients.clear();
  }

  private clearRestartTimer(): void {
    if (!this.restartTimer) {
      return;
    }

    clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }
}
