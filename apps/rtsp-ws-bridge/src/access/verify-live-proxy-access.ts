import type { Request } from 'express';
import type { LiveAccessConfig } from './live-access-config.js';

export interface LiveProxyAccessDecision {
  allowed: boolean;
  reason:
    | 'access_mode_off'
    | 'access_mode_not_proxy'
    | 'proxy_ip_missing'
    | 'proxy_ip_not_allowed'
    | 'proxy_required_header_missing';
  matchedHeader?: string;
  clientIp?: string;
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function readHeader(req: Request, headerName: string): string | undefined {
  const value = req.get(headerName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeIp(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }

  return trimmed;
}

function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  if (allowedIps.length === 0) {
    return true;
  }

  const normalizedClientIp = normalizeIp(clientIp);

  return allowedIps.some((candidate) => normalizeIp(candidate) === normalizedClientIp);
}

export function verifyLiveProxyAccess(
  req: Request,
  liveAccess: LiveAccessConfig
): LiveProxyAccessDecision {
  if (liveAccess.mode === 'off') {
    return {
      allowed: true,
      reason: 'access_mode_off',
      clientIp: req.ip
    };
  }

  if (liveAccess.mode !== 'proxy') {
    return {
      allowed: true,
      reason: 'access_mode_not_proxy',
      clientIp: req.ip
    };
  }

  const clientIp = req.ip?.trim();

  if (!clientIp) {
    return {
      allowed: false,
      reason: 'proxy_ip_missing'
    };
  }

  if (!isIpAllowed(clientIp, liveAccess.proxy.allowedIps)) {
    return {
      allowed: false,
      reason: 'proxy_ip_not_allowed',
      clientIp
    };
  }

  for (const requiredHeader of liveAccess.proxy.requiredHeaders) {
    const headerName = normalizeHeaderName(requiredHeader);

    if (!headerName) {
      continue;
    }

    const headerValue = readHeader(req, headerName);

    if (!headerValue) {
      return {
        allowed: false,
        reason: 'proxy_required_header_missing',
        matchedHeader: headerName,
        clientIp
      };
    }
  }

  return {
    allowed: true,
    reason: 'access_mode_not_proxy',
    clientIp
  };
}
