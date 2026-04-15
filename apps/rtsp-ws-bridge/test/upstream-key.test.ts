import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUpstreamKey,
  normalizeRtspUrl,
  resolveUpstreamDescriptor
} from '../src/bridges/rtsp-ws/upstream-key.js';

test('normalizeRtspUrl trims whitespace', () => {
  const result = normalizeRtspUrl('  rtsp://example.local/live/camera-01  ');
  assert.equal(result, 'rtsp://example.local/live/camera-01');
});

test('normalizeRtspUrl lowercases protocol and hostname', () => {
  const result = normalizeRtspUrl('RTSP://EXAMPLE.LOCAL/live/camera-01');
  assert.equal(result, 'rtsp://example.local/live/camera-01');
});

test('normalizeRtspUrl removes trailing slash in pathname', () => {
  const result = normalizeRtspUrl('rtsp://example.local/live/camera-01/');
  assert.equal(result, 'rtsp://example.local/live/camera-01');
});

test('buildUpstreamKey returns identical key for equivalent urls', () => {
  const a = buildUpstreamKey('RTSP://EXAMPLE.LOCAL/live/camera-01/');
  const b = buildUpstreamKey('rtsp://example.local/live/camera-01');

  assert.equal(a, b);
});

test('resolveUpstreamDescriptor prefers direct rtsp url when provided', () => {
  const result = resolveUpstreamDescriptor({
    streamId: 'camera-01',
    directRtspUrl: ' RTSP://EXAMPLE.LOCAL/live/camera-01/ ',
    rtspUrlTemplate: 'rtsp://template.local/live/{id}'
  });

  assert.equal(result.source, 'direct');
  assert.equal(result.resolvedRtspUrl, 'RTSP://EXAMPLE.LOCAL/live/camera-01/');
  assert.equal(result.normalizedRtspUrl, 'rtsp://example.local/live/camera-01');
  assert.equal(result.upstreamKey, 'rtsp://example.local/live/camera-01');
});

test('resolveUpstreamDescriptor resolves template url and builds upstream key', () => {
  const result = resolveUpstreamDescriptor({
    streamId: 'camera-02',
    rtspUrlTemplate: ' rtsp://template.local/live/{id}/ '
  });

  assert.equal(result.source, 'template');
  assert.equal(result.resolvedRtspUrl, 'rtsp://template.local/live/camera-02/');
  assert.equal(result.normalizedRtspUrl, 'rtsp://template.local/live/camera-02');
  assert.equal(result.upstreamKey, 'rtsp://template.local/live/camera-02');
});

test('resolveUpstreamDescriptor throws when no rtsp source is available', () => {
  assert.throws(
    () => {
      resolveUpstreamDescriptor({
        streamId: 'camera-03'
      });
    },
    {
      message: 'missing rtsp url for stream camera-03'
    }
  );
});

test('same final upstream from direct url and template produce the same upstream key', () => {
  const direct = resolveUpstreamDescriptor({
    streamId: 'camera-04',
    directRtspUrl: 'RTSP://EXAMPLE.LOCAL/live/camera-04/'
  });

  const template = resolveUpstreamDescriptor({
    streamId: 'camera-04',
    rtspUrlTemplate: 'rtsp://example.local/live/{id}'
  });

  assert.equal(direct.upstreamKey, template.upstreamKey);
});
