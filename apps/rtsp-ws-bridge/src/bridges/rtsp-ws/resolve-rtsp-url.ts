export function resolveRtspUrl(
  streamId: string,
  options?: {
    directRtspUrl?: string;
    rtspUrlTemplate?: string;
  }
): string {
  const normalizedDirect = options?.directRtspUrl?.trim();

  if (normalizedDirect) {
    return normalizedDirect;
  }

  const normalizedTemplate = options?.rtspUrlTemplate?.trim();

  if (normalizedTemplate) {
    return normalizedTemplate.replace('{id}', streamId);
  }

  throw new Error(`missing rtsp url for stream ${streamId}`);
}
