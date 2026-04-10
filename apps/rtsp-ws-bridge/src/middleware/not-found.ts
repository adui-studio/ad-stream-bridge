import type { Request, Response } from 'express';
import { logger } from '@adui/logger';

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('route not found', {
    method: req.method,
    path: req.originalUrl
  });

  res.status(404).json({
    ok: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
}

export function errorHandler(error: unknown, req: Request, res: Response): void {
  logger.error('unhandled application error', {
    method: req.method,
    path: req.originalUrl,
    error
  });

  res.status(500).json({
    ok: false,
    error: 'Internal Server Error',
    message: 'Unexpected server error',
    timestamp: new Date().toISOString()
  });
}
