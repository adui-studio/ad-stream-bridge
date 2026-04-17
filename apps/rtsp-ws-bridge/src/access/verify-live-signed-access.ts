import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { LiveAccessConfig } from './live-access-config.js';

export interface LiveSignedAccessParams {
  exp?: string;
  sig?: string;
  nonce?: string;
}

export interface LiveSignedAccessDecision {
  allowed: boolean;
  reason:
    | 'access_mode_off'
    | 'access_mode_not_signed'
    | 'signed_secret_missing'
    | 'signed_exp_missing'
    | 'signed_exp_invalid'
    | 'signed_expired'
    | 'signed_sig_missing'
    | 'signed_sig_invalid';
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeString(item);
      if (normalized) {
        return normalized;
      }
    }

    return undefined;
  }

  return normalizeString(value);
}

export function readSignedAccessParams(req: Request): LiveSignedAccessParams {
  return {
    exp: firstQueryValue(req.query.exp),
    sig: firstQueryValue(req.query.sig),
    nonce: firstQueryValue(req.query.nonce)
  };
}

export function buildSignedPayload(input: {
  streamId: string;
  exp: string;
  rtspUrl?: string;
  nonce?: string;
}): string {
  return [
    `streamId=${input.streamId}`,
    `exp=${input.exp}`,
    `url=${input.rtspUrl ?? ''}`,
    `nonce=${input.nonce ?? ''}`
  ].join('\n');
}

export function computeSignedAccessSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeSignatureEquals(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyLiveSignedAccess(input: {
  req: Request;
  streamId: string;
  rtspUrl?: string;
  liveAccess: LiveAccessConfig;
  nowSec?: number;
}): LiveSignedAccessDecision {
  const { req, streamId, rtspUrl, liveAccess } = input;

  if (liveAccess.mode === 'off') {
    return {
      allowed: true,
      reason: 'access_mode_off'
    };
  }

  if (liveAccess.mode !== 'signed') {
    return {
      allowed: true,
      reason: 'access_mode_not_signed'
    };
  }

  const secret = liveAccess.signed.secret.trim();

  if (!secret) {
    return {
      allowed: false,
      reason: 'signed_secret_missing'
    };
  }

  const { exp, sig, nonce } = readSignedAccessParams(req);

  if (!exp) {
    return {
      allowed: false,
      reason: 'signed_exp_missing'
    };
  }

  const expValue = Number(exp);

  if (!Number.isInteger(expValue) || expValue <= 0) {
    return {
      allowed: false,
      reason: 'signed_exp_invalid'
    };
  }

  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);
  const expiresSkewSec = liveAccess.signed.expiresSkewSec;

  if (expValue + expiresSkewSec < nowSec) {
    return {
      allowed: false,
      reason: 'signed_expired'
    };
  }

  if (!sig) {
    return {
      allowed: false,
      reason: 'signed_sig_missing'
    };
  }

  const payload = buildSignedPayload({
    streamId,
    exp,
    rtspUrl,
    nonce
  });

  const expectedSig = computeSignedAccessSignature(payload, secret);

  if (!safeSignatureEquals(expectedSig, sig)) {
    return {
      allowed: false,
      reason: 'signed_sig_invalid'
    };
  }

  return {
    allowed: true,
    reason: 'access_mode_not_signed'
  };
}
