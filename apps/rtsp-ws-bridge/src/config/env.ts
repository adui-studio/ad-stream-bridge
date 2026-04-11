export interface AppEnv {
  nodeEnv: string;
  host: string;
  port: number;
  logLevel: string;
  ffmpegPath: string;
  rtspUrlTemplate: string;
  streamRestartDelayMs: number;
  streamMaxRestarts: number;
  streamIdleTimeoutMs: number;
  streamSweepIntervalMs: number;
}

const DEFAULTS = {
  nodeEnv: 'development',
  host: '0.0.0.0',
  port: 3000,
  logLevel: 'info',
  ffmpegPath: 'ffmpeg',
  rtspUrlTemplate: '',
  streamRestartDelayMs: 3000,
  streamMaxRestarts: 5,
  streamIdleTimeoutMs: 15000,
  streamSweepIntervalMs: 10000
} as const;

function readString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();

  return normalized || fallback;
}

function readNumber(
  value: string | undefined,
  fallback: number,
  options?: {
    min?: number;
    max?: number;
  }
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (options?.min !== undefined && parsed < options.min) {
    return fallback;
  }

  if (options?.max !== undefined && parsed > options.max) {
    return fallback;
  }

  return parsed;
}

function buildEnv(): AppEnv {
  return {
    nodeEnv: readString(process.env.NODE_ENV, DEFAULTS.nodeEnv),
    host: readString(process.env.HOST, DEFAULTS.host),
    port: readNumber(process.env.PORT, DEFAULTS.port, { min: 1 }),
    logLevel: readString(process.env.LOG_LEVEL, DEFAULTS.logLevel),
    ffmpegPath: readString(process.env.FFMPEG_PATH, DEFAULTS.ffmpegPath),
    rtspUrlTemplate: readString(process.env.RTSP_URL_TEMPLATE, DEFAULTS.rtspUrlTemplate),
    streamRestartDelayMs: readNumber(
      process.env.STREAM_RESTART_DELAY_MS,
      DEFAULTS.streamRestartDelayMs,
      { min: 0 }
    ),
    streamMaxRestarts: readNumber(process.env.STREAM_MAX_RESTARTS, DEFAULTS.streamMaxRestarts, {
      min: 0
    }),
    streamIdleTimeoutMs: readNumber(
      process.env.STREAM_IDLE_TIMEOUT_MS,
      DEFAULTS.streamIdleTimeoutMs,
      { min: 0 }
    ),
    streamSweepIntervalMs: readNumber(
      process.env.STREAM_SWEEP_INTERVAL_MS,
      DEFAULTS.streamSweepIntervalMs,
      { min: 0 }
    )
  };
}

export const env = buildEnv();
