import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import {
  buildSignedPayload,
  computeSignedAccessSignature,
  verifyLiveSignedAccess
} from '../src/access/verify-live-signed-access.js';
import type { LiveAccessConfig } from '../src/access/live-access-config.js';

const baseConfig: LiveAccessConfig = {
  mode: 'signed',
  allowDirectRtspUrl: false,
  allowedStreamIds: [],
  proxy: {
    trustProxyHops: 0,
    allowedIps: [],
    requiredHeaders: []
  },
  signed: {
    secret: 'test-secret',
    expiresSkewSec: 30
  }
};

function createRequest(query: Record<string, unknown>): Request {
  return {
    query
  } as Request;
}

test('verifyLiveSignedAccess allows valid signature', () => {
  const exp = '2000000000';
  const rtspUrl = 'rtsp://example.com/live/cam-01';
  const nonce = 'n-1';

  const payload = buildSignedPayload({
    streamId: 'cam-01',
    exp,
    rtspUrl,
    nonce
  });

  const sig = computeSignedAccessSignature(payload, baseConfig.signed.secret);

  const result = verifyLiveSignedAccess({
    req: createRequest({ exp, sig, nonce }),
    streamId: 'cam-01',
    rtspUrl,
    liveAccess: baseConfig,
    nowSec: 1999999900
  });

  assert.equal(result.allowed, true);
});

test('verifyLiveSignedAccess rejects missing exp', () => {
  const result = verifyLiveSignedAccess({
    req: createRequest({ sig: 'abc' }),
    streamId: 'cam-01',
    liveAccess: baseConfig,
    nowSec: 1000
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'signed_exp_missing');
});

test('verifyLiveSignedAccess rejects expired signature', () => {
  const exp = '1000';
  const payload = buildSignedPayload({
    streamId: 'cam-01',
    exp
  });

  const sig = computeSignedAccessSignature(payload, baseConfig.signed.secret);

  const result = verifyLiveSignedAccess({
    req: createRequest({ exp, sig }),
    streamId: 'cam-01',
    liveAccess: baseConfig,
    nowSec: 1031
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'signed_expired');
});

test('verifyLiveSignedAccess rejects invalid signature', () => {
  const result = verifyLiveSignedAccess({
    req: createRequest({
      exp: '2000000000',
      sig: 'deadbeef'
    }),
    streamId: 'cam-01',
    liveAccess: baseConfig,
    nowSec: 1999999900
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'signed_sig_invalid');
});

test('verifyLiveSignedAccess binds signature to url', () => {
  const exp = '2000000000';
  const signedForUrl = 'rtsp://example.com/live/cam-01';
  const tamperedUrl = 'rtsp://example.com/live/cam-02';

  const payload = buildSignedPayload({
    streamId: 'cam-01',
    exp,
    rtspUrl: signedForUrl
  });

  const sig = computeSignedAccessSignature(payload, baseConfig.signed.secret);

  const result = verifyLiveSignedAccess({
    req: createRequest({ exp, sig }),
    streamId: 'cam-01',
    rtspUrl: tamperedUrl,
    liveAccess: baseConfig,
    nowSec: 1999999900
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'signed_sig_invalid');
});

test('verifyLiveSignedAccess bypasses validation when mode is off', () => {
  const result = verifyLiveSignedAccess({
    req: createRequest({}),
    streamId: 'cam-01',
    liveAccess: {
      ...baseConfig,
      mode: 'off'
    }
  });

  assert.equal(result.allowed, true);
});
