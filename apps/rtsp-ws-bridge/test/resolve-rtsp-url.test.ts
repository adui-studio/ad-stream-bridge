import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveRtspUrl } from '../src/bridges/rtsp-ws/resolve-rtsp-url.js';

test('resolveRtspUrl prefers direct query url when provided', () => {
  const result = resolveRtspUrl('camera-01', {
    directRtspUrl: 'rtsp://direct-source/live.sdp',
    rtspUrlTemplate: 'rtsp://template-host/live/{id}'
  });

  assert.equal(result, 'rtsp://direct-source/live.sdp');
});

test('resolveRtspUrl trims direct query url before returning', () => {
  const result = resolveRtspUrl('camera-01', {
    directRtspUrl: '   rtsp://direct-source/live.sdp   ',
    rtspUrlTemplate: 'rtsp://template-host/live/{id}'
  });

  assert.equal(result, 'rtsp://direct-source/live.sdp');
});

test('resolveRtspUrl falls back to template when direct url is missing', () => {
  const result = resolveRtspUrl('camera-01', {
    rtspUrlTemplate: 'rtsp://template-host/live/{id}'
  });

  assert.equal(result, 'rtsp://template-host/live/camera-01');
});

test('resolveRtspUrl trims template before using it', () => {
  const result = resolveRtspUrl('camera-02', {
    rtspUrlTemplate: '   rtsp://template-host/live/{id}   '
  });

  assert.equal(result, 'rtsp://template-host/live/camera-02');
});

test('resolveRtspUrl throws when both direct url and template are missing', () => {
  assert.throws(
    () => {
      resolveRtspUrl('camera-03');
    },
    {
      message: 'missing rtsp url for stream camera-03'
    }
  );
});

test('resolveRtspUrl throws when direct url is blank and template is blank', () => {
  assert.throws(
    () => {
      resolveRtspUrl('camera-04', {
        directRtspUrl: '   ',
        rtspUrlTemplate: '   '
      });
    },
    {
      message: 'missing rtsp url for stream camera-04'
    }
  );
});
