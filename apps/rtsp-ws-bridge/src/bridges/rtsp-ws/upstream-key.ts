import { resolveRtspUrl } from './resolve-rtsp-url.js';

export type RtspUrlSource = 'direct' | 'template';

export interface ResolveUpstreamDescriptorInput {
  streamId: string;
  directRtspUrl?: string;
  rtspUrlTemplate?: string;
}

export interface UpstreamDescriptor {
  streamId: string;
  source: RtspUrlSource;
  resolvedRtspUrl: string;
  normalizedRtspUrl: string;
  upstreamKey: string;
}

function stripTrailingSlashes(pathname: string): string {
  if (!pathname || pathname === '/') {
    return pathname || '/';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : '/';
}

export function normalizeRtspUrl(rawRtspUrl: string): string {
  const trimmed = rawRtspUrl.trim();
  if (!trimmed) {
    throw new Error('rtsp url must not be blank');
  }

  try {
    const url = new URL(trimmed);

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.pathname = stripTrailingSlashes(url.pathname);

    return url.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

export function buildUpstreamKey(resolvedRtspUrl: string): string {
  return normalizeRtspUrl(resolvedRtspUrl);
}

export function resolveUpstreamDescriptor(
  input: ResolveUpstreamDescriptorInput
): UpstreamDescriptor {
  const source: RtspUrlSource = input.directRtspUrl?.trim() ? 'direct' : 'template';

  const resolvedRtspUrl = resolveRtspUrl(input.streamId, {
    directRtspUrl: input.directRtspUrl,
    rtspUrlTemplate: input.rtspUrlTemplate
  });

  const normalizedRtspUrl = normalizeRtspUrl(resolvedRtspUrl);
  const upstreamKey = buildUpstreamKey(resolvedRtspUrl);

  return {
    streamId: input.streamId,
    source,
    resolvedRtspUrl,
    normalizedRtspUrl,
    upstreamKey
  };
}
