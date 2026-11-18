import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, ErrorCode } from '@api-monitoring/shared';
import { logger } from '../config/logger.js';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 400,
    public details?: any[]
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn('AppError handled:', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      requestId,
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details || [],
      },
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError' || Array.isArray(err?.issues)) {
    const issues = err.issues || [];
    const details = issues.map((i: any) => ({
      field: Array.isArray(i.path) ? i.path.join('.') : String(i.path || ''),
      message: i.message,
      code: i.code,
    }));

    logger.warn('Validation error handled:', { details, requestId });

    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Validation failed for request parameters or body',
        requestId,
        details,
      },
    });
    return;
  }

  logger.error('Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    requestId,
  });

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An internal error occurred',
      requestId,
      details: [],
    },
  });
}
