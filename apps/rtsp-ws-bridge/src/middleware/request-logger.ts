import type { NextFunction, Request, Response } from 'express';
import { logger } from '@adui/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startAt;

    logger.info('http request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.get('user-agent') || '',
      ip: req.ip
    });
  });

  next();
}
