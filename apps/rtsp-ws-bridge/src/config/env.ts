import {
  type LiveAccessConfig,
  type LiveAccessMode,
  isLiveAccessMode
} from '../access/live-access-config.js';

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
  liveAccess: LiveAccessConfig;
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
  streamSweepIntervalMs: 10000,

  liveAccessMode: 'off' as LiveAccessMode,
  liveAllowDirectRtspUrl: false,
  liveAllowedStreamIds: [] as string[],
  trustProxyHops: 0,
  liveProxyAllowedIps: [] as string[],
  liveProxyRequiredHeaders: [] as string[],
  liveSignedSecret: '',
  liveSignedExpiresSkewSec: 30
} as const;

function readString(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function readNumber(
  value: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number }
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

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readLiveAccessMode(value: string | undefined, fallback: LiveAccessMode): LiveAccessMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return isLiveAccessMode(normalized) ? normalized : fallback;
}

function buildLiveAccessConfig(): LiveAccessConfig {
  const mode = readLiveAccessMode(process.env.LIVE_ACCESS_MODE, DEFAULTS.liveAccessMode);

  return {
    mode,
    allowDirectRtspUrl: readBoolean(
      process.env.LIVE_ALLOW_DIRECT_RTSP_URL,
      DEFAULTS.liveAllowDirectRtspUrl
    ),
    allowedStreamIds: readStringList(process.env.LIVE_ALLOWED_STREAM_IDS),
    proxy: {
      trustProxyHops: readNumber(process.env.TRUST_PROXY_HOPS, DEFAULTS.trustProxyHops, { min: 0 }),
      allowedIps: readStringList(process.env.LIVE_PROXY_ALLOWED_IPS),
      requiredHeaders: readStringList(process.env.LIVE_PROXY_REQUIRED_HEADERS)
    },
    signed: {
      secret: readString(process.env.LIVE_SIGNED_SECRET, DEFAULTS.liveSignedSecret),
      expiresSkewSec: readNumber(
        process.env.LIVE_SIGNED_EXPIRES_SKEW_SEC,
        DEFAULTS.liveSignedExpiresSkewSec,
        { min: 0 }
      )
    }
  };
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
    ),
    liveAccess: buildLiveAccessConfig()
  };
}

export const env = buildEnv();
