import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import type { WebSocket } from 'ws';
import { logger } from '@adui/logger';
import { env } from '../../config/env.js';

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
  sessionId: string;
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

type StopMode = 'shutdown' | 'restart';

const DEFAULT_RESTART_DELAY_MS = env.streamRestartDelayMs;
const DEFAULT_MAX_RESTARTS = env.streamMaxRestarts;

export class FfmpegSession {
  private readonly sessionId: string;
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
    this.sessionId = `${options.streamId}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    this.streamId = options.streamId;
    this.rtspUrl = options.rtspUrl;
    this.ffmpegPath = options.ffmpegPath || env.ffmpegPath;
    this.restartDelayMs = this.normalizeNumber(
      options.restartDelayMs,
      DEFAULT_RESTART_DELAY_MS,
      3000
    );
    this.maxRestarts = this.normalizeNumber(options.maxRestarts, DEFAULT_MAX_RESTARTS, 5);
    this.ffmpegArgs = options.ffmpegArgs ?? this.buildDefaultArgs();
  }

  start(): void {
    const currentPid = this.child ? (this.child.pid ?? null) : null;

    if (this.child || this.state === 'starting' || this.state === 'running') {
      logger.warn('ffmpeg session start skipped: already active', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid: currentPid,
        reason: 'already_active',
        state: this.state
      });
      return;
    }

    this.clearRestartTimer();
    this.shouldRestart = true;
    this.state = 'starting';
    this.stderrBuffer = '';

    logger.info('ffmpeg session starting', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid: null,
      reason: 'start',
      ffmpegPath: this.ffmpegPath,
      ffmpegArgs: this.ffmpegArgs,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      clientCount: this.clients.size
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

    logger.info('ffmpeg session started', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid: child.pid ?? null,
      reason: 'spawned',
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      clientCount: this.clients.size
    });
  }

  stop(reason = 'manual stop'): void {
    this.stopInternal({
      reason,
      mode: 'shutdown',
      clearClients: true,
      disableRestart: true
    });
  }

  restart(reason = 'manual restart'): void {
    const currentPid = this.child ? (this.child.pid ?? null) : null;

    logger.warn('ffmpeg session restarting', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid: currentPid,
      reason,
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      clientCount: this.clients.size
    });

    this.stopInternal({
      reason,
      mode: 'restart',
      clearClients: false,
      disableRestart: false
    });

    this.restartCount += 1;
    this.lastRestartAt = Date.now();
    this.start();
  }

  attachClient(client: SessionClient): void {
    const currentPid = this.child ? (this.child.pid ?? null) : null;
    const existingBinding = this.clientBindings.get(client.ws);

    if (existingBinding) {
      logger.warn('ffmpeg session attach skipped: websocket already attached', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid: currentPid,
        reason: 'already_attached',
        clientIp: client.clientIp || existingBinding.clientIp || 'unknown',
        clientCount: this.clients.size
      });
      return;
    }

    const closeHandler = () => {
      this.detachClient(client.ws, 'websocket close');
    };

    const errorHandler = (error: Error) => {
      const pid = this.child ? (this.child.pid ?? null) : null;

      logger.error('ffmpeg session websocket client error', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid,
        reason: 'websocket_error',
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
      sessionId: this.sessionId,
      pid: currentPid,
      reason: 'client_attach',
      clientIp: client.clientIp || 'unknown',
      clientCount: this.clients.size
    });
  }

  detachClient(ws: WebSocket, reason = 'manual detach'): void {
    const currentPid = this.child ? (this.child.pid ?? null) : null;
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
      sessionId: this.sessionId,
      pid: currentPid,
      reason,
      clientIp: binding?.clientIp || 'unknown',
      clientCount: this.clients.size
    });
  }

  getSnapshot(): FfmpegSessionSnapshot {
    const currentPid = this.child ? (this.child.pid ?? null) : null;

    return {
      sessionId: this.sessionId,
      streamId: this.streamId,
      rtspUrl: this.rtspUrl,
      state: this.state,
      pid: currentPid,
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

  private stopInternal(options: {
    reason: string;
    mode: StopMode;
    clearClients: boolean;
    disableRestart: boolean;
  }): void {
    const { reason, mode, clearClients, disableRestart } = options;

    if (disableRestart) {
      this.shouldRestart = false;
    }

    this.clearRestartTimer();

    const child = this.child;

    if (!child) {
      if (clearClients) {
        this.clearAllClientBindings();
      }

      this.state = 'stopped';
      this.lastStoppedAt = Date.now();

      logger.info('ffmpeg session stop skipped: no active process', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid: null,
        reason,
        mode,
        clearClients,
        shouldRestart: this.shouldRestart,
        restartCount: this.restartCount,
        clientCount: this.clients.size
      });

      return;
    }

    this.state = 'stopping';

    logger.info('ffmpeg session stopping', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid: child.pid ?? null,
      reason,
      mode,
      clearClients,
      shouldRestart: this.shouldRestart,
      restartCount: this.restartCount,
      clientCount: this.clients.size
    });

    this.removeChildListeners(child);

    try {
      child.kill('SIGTERM');
    } catch (error) {
      this.lastErrorAt = Date.now();

      logger.error('failed to stop ffmpeg session cleanly', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid: child.pid ?? null,
        reason: 'kill_failed',
        stopReason: reason,
        mode,
        error
      });
    }

    this.child = null;
    this.lastStoppedAt = Date.now();
    this.lastExitCode = null;
    this.lastExitSignal = 'SIGTERM';
    this.state = 'stopped';

    if (clearClients) {
      this.clearAllClientBindings();
    }
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
    const currentPid = this.child ? (this.child.pid ?? null) : null;

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
          sessionId: this.sessionId,
          pid: currentPid,
          reason: 'stdout_forward_failed',
          error
        });

        this.detachClient(client, 'stdout forward failed');
      }
    }
  };

  private readonly handleStderr = (chunk: Buffer): void => {
    const currentPid = this.child ? (this.child.pid ?? null) : null;
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
        sessionId: this.sessionId,
        pid: currentPid,
        reason: 'stderr',
        message
      });
    }
  };

  private readonly handleError = (error: Error): void => {
    const currentPid = this.child ? (this.child.pid ?? null) : null;
    this.lastErrorAt = Date.now();
    this.state = 'errored';

    logger.error('ffmpeg session process error', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid: currentPid,
      reason: 'process_error',
      restartCount: this.restartCount,
      lastRestartAt: this.lastRestartAt,
      clientCount: this.clients.size,
      error
    });
  };

  private readonly handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    const child = this.child;
    const pid = child?.pid ?? null;

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
      sessionId: this.sessionId,
      pid,
      reason: wasManualStop ? 'manual_stop' : 'unexpected_exit',
      code,
      signal,
      wasManualStop,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      clientCount: this.clients.size
    });

    if (wasManualStop) {
      logger.info('ffmpeg session restart skipped after manual stop', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid,
        reason: 'manual_stop',
        code,
        signal,
        clientCount: this.clients.size
      });
      return;
    }

    if (this.restartCount >= this.maxRestarts) {
      this.state = 'errored';

      logger.error('ffmpeg session reached max restart limit', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid,
        reason: 'max_restart_limit_reached',
        restartCount: this.restartCount,
        maxRestarts: this.maxRestarts,
        lastExitCode: this.lastExitCode,
        lastExitSignal: this.lastExitSignal,
        clientCount: this.clients.size
      });

      return;
    }

    this.restartCount += 1;
    this.lastRestartAt = Date.now();

    logger.warn('ffmpeg session restart scheduled', {
      streamId: this.streamId,
      sessionId: this.sessionId,
      pid,
      reason: 'unexpected_exit',
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      restartDelayMs: this.restartDelayMs,
      lastRestartAt: this.lastRestartAt,
      lastExitCode: this.lastExitCode,
      lastExitSignal: this.lastExitSignal,
      clientCount: this.clients.size
    });

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      const restartPid = this.child ? (this.child.pid ?? null) : null;

      logger.info('ffmpeg session restart executing', {
        streamId: this.streamId,
        sessionId: this.sessionId,
        pid: restartPid,
        reason: 'scheduled_restart',
        restartCount: this.restartCount,
        maxRestarts: this.maxRestarts,
        restartDelayMs: this.restartDelayMs,
        lastRestartAt: this.lastRestartAt,
        clientCount: this.clients.size
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
