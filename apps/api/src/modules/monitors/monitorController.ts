import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Monitor, IMonitor } from '../../db/Monitor.js';
import { HealthCheck } from '../../db/HealthCheck.js';
import { AuditEvent } from '../../db/AuditEvent.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validateAndResolveUrl } from '../../services/ssrfValidator.js';
import { encryptObject, encryptString } from '../../services/cryptoService.js';
import { emitToWorkspace } from '../../realtime/socket.js';
import {
  ERROR_CODES,
  MONITOR_STATUS,
  SOCKET_EVENTS,
  CHECK_OUTCOME,
  MonitorDto,
  HealthCheckDto,
} from '@api-monitoring/shared';

function toMonitorDto(monitor: IMonitor, uptimes?: { uptime24h?: number | null; uptime7d?: number | null; uptime30d?: number | null }): MonitorDto {
  return {
    id: monitor._id.toString(),
    workspaceId: monitor.workspaceId.toString(),
    name: monitor.name,
    url: monitor.url,
    normalizedHost: monitor.normalizedHost,
    method: monitor.method,
    intervalSeconds: monitor.intervalSeconds,
    timeoutMs: monitor.timeoutMs,
    expectedStatusCodes: monitor.expectedStatusCodes,
    headersConfigured: !!monitor.headersEncrypted,
    bodyConfigured: !!monitor.bodyEncrypted,
    bodyContentType: monitor.bodyContentType,
    active: monitor.active,
    status: monitor.status,
    lastStatus: monitor.lastStatus,
    lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
    nextRunAt: monitor.nextRunAt ? monitor.nextRunAt.toISOString() : null,
    lastLatencyMs: monitor.lastLatencyMs,
    consecutiveFailures: monitor.consecutiveFailures,
    recentSuccessRatio: monitor.recentSuccessRatio,
    latencyThresholdMs: monitor.latencyThresholdMs,
    uptime24h: uptimes?.uptime24h ?? null,
    uptime7d: uptimes?.uptime7d ?? null,
    uptime30d: uptimes?.uptime30d ?? null,
    createdBy: monitor.createdBy.toString(),
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
  };
}

async function computeUptime(workspaceId: mongoose.Types.ObjectId, monitorId: mongoose.Types.ObjectId, days: number): Promise<number | null> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const checks = await HealthCheck.find({
    workspaceId,
    monitorId,
    completedAt: { $gte: cutoff },
  }).select('outcome').lean();

  if (checks.length === 0) return null;
  const successes = checks.filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS).length;
  return Math.round((successes / checks.length) * 1000) / 10;
}

export async function listMonitors(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { page = 1, limit = 20, status, search, active } = req.query as any;

  const query: any = {
    workspaceId,
    deletedAt: null,
  };

  if (status) {
    query.status = status;
  }
  if (active !== undefined) {
    query.active = active === 'true';
  }
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { url: { $regex: search, $options: 'i' } },
      { normalizedHost: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [monitors, total] = await Promise.all([
    Monitor.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Monitor.countDocuments(query),
  ]);

  const data = monitors.map((m) => toMonitorDto(m));

  res.json({
    data,
    meta: {
      requestId: req.requestId || '',
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + monitors.length < total,
    },
  });
}

export async function createMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const {
    name,
    url,
    method = 'GET',
    intervalSeconds = 60,
    timeoutMs = 10000,
    expectedStatusCodes = [200, 204],
    latencyThresholdMs = 2000,
    headers = [],
    body,
    bodyContentType = 'application/json',
  } = req.body;

  // SSRF validation before saving
  const validation = await validateAndResolveUrl(url);
  if (!validation.valid || !validation.url) {
    return next(new AppError(ERROR_CODES.SSRF_BLOCKED, validation.reason || 'URL destination blocked by security policy', 400));
  }

  const normalizedHost = validation.url.host;

  // Encrypt sensitive headers and body
  const encryptedHeaders = headers && headers.length > 0 ? encryptObject(headers) : null;
  const encryptedBody = body ? encryptString(body) : null;

  const monitor = await Monitor.create({
    workspaceId,
    name: name.trim(),
    url: url.trim(),
    normalizedHost,
    method,
    intervalSeconds,
    timeoutMs,
    expectedStatusCodes,
    latencyThresholdMs,
    headersEncrypted: encryptedHeaders,
    bodyEncrypted: encryptedBody,
    bodyContentType,
    active: true,
    status: MONITOR_STATUS.UNKNOWN,
    lastStatus: MONITOR_STATUS.UNKNOWN,
    nextRunAt: new Date(), // Immediate execution
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });

  await AuditEvent.create({
    workspaceId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    action: 'MONITOR_CREATED',
    resourceType: 'monitor',
    resourceId: monitor._id.toString(),
    metadataSafe: { name: monitor.name, url: monitor.url, method: monitor.method },
  });

  res.status(201).json({
    data: toMonitorDto(monitor),
    meta: { requestId: req.requestId || '' },
  });
}

export async function getMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  // Calculate 24h, 7d, 30d uptime
  const [uptime24h, uptime7d, uptime30d] = await Promise.all([
    computeUptime(workspaceId, monitor._id as mongoose.Types.ObjectId, 1),
    computeUptime(workspaceId, monitor._id as mongoose.Types.ObjectId, 7),
    computeUptime(workspaceId, monitor._id as mongoose.Types.ObjectId, 30),
  ]);

  res.json({
    data: toMonitorDto(monitor, { uptime24h, uptime7d, uptime30d }),
    meta: { requestId: req.requestId || '' },
  });
}

export async function updateMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const {
    name,
    url,
    method,
    intervalSeconds,
    timeoutMs,
    expectedStatusCodes,
    latencyThresholdMs,
    headers,
    body,
    bodyContentType,
  } = req.body;

  if (url && url !== monitor.url) {
    const validation = await validateAndResolveUrl(url);
    if (!validation.valid || !validation.url) {
      return next(new AppError(ERROR_CODES.SSRF_BLOCKED, validation.reason || 'URL destination blocked by security policy', 400));
    }
    monitor.url = url.trim();
    monitor.normalizedHost = validation.url.host;
  }

  if (name) monitor.name = name.trim();
  if (method) monitor.method = method;
  if (intervalSeconds) monitor.intervalSeconds = intervalSeconds;
  if (timeoutMs) monitor.timeoutMs = timeoutMs;
  if (expectedStatusCodes) monitor.expectedStatusCodes = expectedStatusCodes;
  if (latencyThresholdMs) monitor.latencyThresholdMs = latencyThresholdMs;
  if (bodyContentType) monitor.bodyContentType = bodyContentType;

  if (headers !== undefined) {
    monitor.headersEncrypted = headers && headers.length > 0 ? encryptObject(headers) : null;
  }
  if (body !== undefined) {
    monitor.bodyEncrypted = body ? encryptString(body) : null;
  }

  await monitor.save();

  await AuditEvent.create({
    workspaceId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    action: 'MONITOR_UPDATED',
    resourceType: 'monitor',
    resourceId: monitor._id.toString(),
    metadataSafe: { name: monitor.name },
  });

  res.json({
    data: toMonitorDto(monitor),
    meta: { requestId: req.requestId || '' },
  });
}

export async function pauseMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const prior = monitor.status;
  monitor.active = false;
  monitor.lastStatus = prior;
  monitor.status = MONITOR_STATUS.PAUSED;
  await monitor.save();

  emitToWorkspace(workspaceId.toString(), SOCKET_EVENTS.MONITOR_STATUS_UPDATED, {
    monitorId: monitor._id.toString(),
    status: MONITOR_STATUS.PAUSED,
    lastStatus: prior,
  });

  res.json({
    data: toMonitorDto(monitor),
    meta: { requestId: req.requestId || '' },
  });
}

export async function resumeMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const prior = monitor.status;
  monitor.active = true;
  monitor.lastStatus = prior;
  monitor.status = MONITOR_STATUS.UNKNOWN;
  monitor.nextRunAt = new Date(); // Immediate check
  await monitor.save();

  emitToWorkspace(workspaceId.toString(), SOCKET_EVENTS.MONITOR_STATUS_UPDATED, {
    monitorId: monitor._id.toString(),
    status: MONITOR_STATUS.UNKNOWN,
    lastStatus: prior,
  });

  res.json({
    data: toMonitorDto(monitor),
    meta: { requestId: req.requestId || '' },
  });
}

export async function deleteMonitor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  monitor.deletedAt = new Date();
  monitor.active = false;
  await monitor.save();

  await AuditEvent.create({
    workspaceId,
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    action: 'MONITOR_DELETED',
    resourceType: 'monitor',
    resourceId: monitor._id.toString(),
    metadataSafe: { name: monitor.name },
  });

  res.json({
    data: { message: 'Monitor deleted successfully' },
    meta: { requestId: req.requestId || '' },
  });
}

export async function getMonitorChecks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;
  const { page = 1, limit = 20 } = req.query as any;

  if (!monitorId || !mongoose.isValidObjectId(monitorId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const monitor = await Monitor.findOne({
    _id: new mongoose.Types.ObjectId(monitorId),
    workspaceId,
    deletedAt: null,
  });

  if (!monitor) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [checks, total] = await Promise.all([
    HealthCheck.find({
      workspaceId,
      monitorId: monitor._id,
    })
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limitNum),
    HealthCheck.countDocuments({
      workspaceId,
      monitorId: monitor._id,
    }),
  ]);

  const data: HealthCheckDto[] = checks.map((c) => ({
    id: c._id.toString(),
    monitorId: c.monitorId.toString(),
    scheduledAt: c.scheduledAt.toISOString(),
    startedAt: c.startedAt.toISOString(),
    completedAt: c.completedAt.toISOString(),
    outcome: c.outcome,
    statusCode: c.statusCode,
    latencyMs: c.latencyMs,
    errorCategory: c.errorCategory,
    errorMessageSafe: c.errorMessageSafe,
    responseBytes: c.responseBytes,
    traceId: c.traceId || undefined,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json({
    data,
    meta: {
      requestId: req.requestId || '',
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + checks.length < total,
    },
  });
}
