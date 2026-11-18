import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestCorrelation(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
