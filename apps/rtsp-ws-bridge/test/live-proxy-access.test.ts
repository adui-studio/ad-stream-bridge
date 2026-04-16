import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Request, Response } from 'express';
import { verifyLiveProxyAccess } from '../src/access/verify-live-proxy-access.js';
import type { LiveAccessConfig } from '../src/access/live-access-config.js';

const baseConfig: LiveAccessConfig = {
  mode: 'proxy',
  allowDirectRtspUrl: false,
  allowedStreamIds: [],
  proxy: {
    trustProxyHops: 1,
    allowedIps: ['127.0.0.1'],
    requiredHeaders: []
  },
  signed: {
    secret: '',
    expiresSkewSec: 30
  }
};

function createRequest(
  forwardedFor: string | undefined,
  headers: Record<string, string> = {}
): Request {
  const app = express();
  app.set('trust proxy', 1);

  let capturedReq: Request | null = null;

  app.get('/test', (req: Request, res: Response) => {
    capturedReq = req;
    res.status(204).end();
  });

  const req = {
    method: 'GET',
    url: '/test',
    headers: {
      host: 'localhost',
      ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
      ...headers
    },
    app
  } as unknown as Request;

  Object.defineProperty(req, 'app', { value: app });
  Object.defineProperty(req, 'headers', { value: req.headers });
  Object.defineProperty(req, 'socket', { value: { remoteAddress: '127.0.0.1' } });

  const requestPrototype = Object.getPrototypeOf(app.request);
  Object.setPrototypeOf(req, requestPrototype);

  return req;
}

test('verifyLiveProxyAccess allows trusted proxy client ip', () => {
  const req = createRequest('127.0.0.1');
  const result = verifyLiveProxyAccess(req, baseConfig);

  assert.equal(result.allowed, true);
});

test('verifyLiveProxyAccess rejects client ip outside allowlist', () => {
  const req = createRequest('10.0.0.8');
  const result = verifyLiveProxyAccess(req, baseConfig);

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'proxy_ip_not_allowed');
});

test('verifyLiveProxyAccess rejects when required header is missing', () => {
  const req = createRequest('127.0.0.1');
  const result = verifyLiveProxyAccess(req, {
    ...baseConfig,
    proxy: {
      ...baseConfig.proxy,
      requiredHeaders: ['x-internal-gateway']
    }
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'proxy_required_header_missing');
  assert.equal(result.matchedHeader, 'x-internal-gateway');
});

test('verifyLiveProxyAccess allows when required header exists', () => {
  const req = createRequest('127.0.0.1', {
    'x-internal-gateway': '1'
  });

  const result = verifyLiveProxyAccess(req, {
    ...baseConfig,
    proxy: {
      ...baseConfig.proxy,
      requiredHeaders: ['x-internal-gateway']
    }
  });

  assert.equal(result.allowed, true);
});

test('verifyLiveProxyAccess bypasses validation when mode is off', () => {
  const req = createRequest(undefined);

  const result = verifyLiveProxyAccess(req, {
    ...baseConfig,
    mode: 'off'
  });

  assert.equal(result.allowed, true);
});
