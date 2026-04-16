export const LIVE_ACCESS_MODES = ['off', 'proxy', 'signed'] as const;

export type LiveAccessMode = (typeof LIVE_ACCESS_MODES)[number];

export interface LiveProxyAccessConfig {
  trustProxyHops: number;
  allowedIps: string[];
  requiredHeaders: string[];
}

export interface LiveSignedAccessConfig {
  secret: string;
  expiresSkewSec: number;
}

export interface LiveAccessConfig {
  mode: LiveAccessMode;
  allowDirectRtspUrl: boolean;
  allowedStreamIds: string[];
  proxy: LiveProxyAccessConfig;
  signed: LiveSignedAccessConfig;
}

export function isLiveAccessMode(value: string): value is LiveAccessMode {
  return (LIVE_ACCESS_MODES as readonly string[]).includes(value);
}
