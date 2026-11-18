import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Monitor } from '../../db/Monitor.js';
import { HealthCheck } from '../../db/HealthCheck.js';
import { Incident } from '../../db/Incident.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  computePercentiles,
  aggregateTimeSeries,
  calculateStatusCodeDistribution,
} from '../../services/analyticsAggregator.js';
import {
  ERROR_CODES,
  MONITOR_STATUS,
  INCIDENT_STATUS,
  CHECK_OUTCOME,
  AnalyticsBucket,
  CONFIG_DEFAULTS,
  AnalyticsSummaryDto,
  EndpointAnalyticsDto,
} from '@api-monitoring/shared';

function parseDateRange(fromStr?: string, toStr?: string, defaultDays: number = 7): { from: Date; to: Date } {
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);

  // Maximum analytics range: 90 days
  const maxRangeMs = CONFIG_DEFAULTS.MAX_ANALYTICS_RANGE_DAYS * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Analytics date range cannot exceed ${CONFIG_DEFAULTS.MAX_ANALYTICS_RANGE_DAYS} days`, 400);
  }

  return { from, to };
}

export async function getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { from: fromStr, to: toStr } = req.query as any;

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseDateRange(fromStr, toStr, 7);
  } catch (err) {
    return next(err);
  }

  // 1. Monitor counts by status
  const monitors = await Monitor.find({ workspaceId, deletedAt: null }).select('status lastLatencyMs');

  const summary: AnalyticsSummaryDto = {
    totalMonitors: monitors.length,
    operational: 0,
    degraded: 0,
    down: 0,
    paused: 0,
    unknown: 0,
    overallUptimePercent: null,
    averageLatencyMs: null,
    activeIncidentsCount: 0,
  };

  for (const m of monitors) {
    if (m.status === MONITOR_STATUS.OPERATIONAL) summary.operational++;
    else if (m.status === MONITOR_STATUS.DEGRADED) summary.degraded++;
    else if (m.status === MONITOR_STATUS.DOWN) summary.down++;
    else if (m.status === MONITOR_STATUS.PAUSED) summary.paused++;
    else summary.unknown++;
  }

  // 2. Active incidents count
  summary.activeIncidentsCount = await Incident.countDocuments({
    workspaceId,
    status: { $in: [INCIDENT_STATUS.OPEN, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.INVESTIGATING] },
  });

  // 3. Aggregate checks in range for uptime and average latency
  const checks = await HealthCheck.find({
    workspaceId,
    completedAt: { $gte: dateRange.from, $lte: dateRange.to },
  })
    .select('outcome latencyMs')
    .lean();

  if (checks.length > 0) {
    const successes = checks.filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS);
    summary.overallUptimePercent = Math.round((successes.length / checks.length) * 1000) / 10;

    if (successes.length > 0) {
      const totalLatency = successes.reduce((acc, c) => acc + c.latencyMs, 0);
      summary.averageLatencyMs = Math.round((totalLatency / successes.length) * 10) / 10;
    }
  }

  res.json({
    data: summary,
    meta: {
      requestId: req.requestId || '',
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
  });
}

export async function getMonitorAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const monitorId = req.params.id as string;
  const { from: fromStr, to: toStr, bucket = '1h' } = req.query as any;

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

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseDateRange(fromStr, toStr, 7);
  } catch (err) {
    return next(err);
  }

  const checks = await HealthCheck.find({
    workspaceId,
    monitorId: monitor._id,
    completedAt: { $gte: dateRange.from, $lte: dateRange.to },
  })
    .sort({ completedAt: 1 })
    .select('completedAt outcome statusCode latencyMs')
    .lean();

  const successChecks = checks.filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS);
  const successLatencies = successChecks.map((c) => c.latencyMs);

  const percentiles = computePercentiles(successLatencies);
  const uptimePercent =
    checks.length > 0
      ? Math.round((successChecks.length / checks.length) * 1000) / 10
      : null;

  const statusDistribution = calculateStatusCodeDistribution(checks);
  const timeSeries = aggregateTimeSeries(checks, bucket as AnalyticsBucket);

  // Detect anomalies: checks where latency exceeded threshold or outcome failed
  const anomalies = checks
    .filter((c) => c.latencyMs > monitor.latencyThresholdMs || c.outcome !== CHECK_OUTCOME.SUCCESS)
    .slice(-20)
    .map((c) => ({
      timestamp: c.completedAt.toISOString(),
      type: c.outcome !== CHECK_OUTCOME.SUCCESS ? 'failure' : 'high_latency',
      observedValue: c.latencyMs,
      threshold: monitor.latencyThresholdMs,
      message:
        c.outcome !== CHECK_OUTCOME.SUCCESS
          ? `Check failed with status ${c.statusCode ?? 'network/timeout error'}`
          : `Latency reached ${c.latencyMs}ms (threshold: ${monitor.latencyThresholdMs}ms)`,
    }));

  const data: EndpointAnalyticsDto = {
    monitorId: monitor._id.toString(),
    name: monitor.name,
    timeRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    sampleCount: checks.length,
    uptimePercent,
    averageLatencyMs: percentiles.avg,
    minLatencyMs: percentiles.min,
    maxLatencyMs: percentiles.max,
    p50LatencyMs: percentiles.p50,
    p95LatencyMs: percentiles.p95,
    p99LatencyMs: percentiles.p99,
    statusDistribution,
    timeSeries,
    anomalies,
  };

  res.json({
    data,
    meta: { requestId: req.requestId || '' },
  });
}

export async function compareMonitors(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { monitorIds, from: fromStr, to: toStr } = req.query as any;

  if (!monitorIds || typeof monitorIds !== 'string') {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'monitorIds query parameter required', 400));
  }

  const ids = monitorIds
    .split(',')
    .map((id) => id.trim())
    .filter((id) => mongoose.isValidObjectId(id));

  if (ids.length === 0) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'At least one valid monitor ID required', 400));
  }

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseDateRange(fromStr, toStr, 7);
  } catch (err) {
    return next(err);
  }

  const monitors = await Monitor.find({
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    workspaceId,
    deletedAt: null,
  }).select('name method url latencyThresholdMs');

  const comparisons = await Promise.all(
    monitors.map(async (m) => {
      const checks = await HealthCheck.find({
        workspaceId,
        monitorId: m._id,
        completedAt: { $gte: dateRange.from, $lte: dateRange.to },
      })
        .select('outcome latencyMs')
        .lean();

      const successes = checks.filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS);
      const latencies = successes.map((c) => c.latencyMs);
      const percentiles = computePercentiles(latencies);
      const uptime = checks.length > 0 ? Math.round((successes.length / checks.length) * 1000) / 10 : null;

      return {
        monitorId: m._id.toString(),
        name: m.name,
        method: m.method,
        url: m.url,
        sampleCount: checks.length,
        uptimePercent: uptime,
        avgLatencyMs: percentiles.avg,
        p50LatencyMs: percentiles.p50,
        p95LatencyMs: percentiles.p95,
        p99LatencyMs: percentiles.p99,
      };
    })
  );

  res.json({
    data: comparisons,
    meta: {
      requestId: req.requestId || '',
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
  });
}

export async function getStatusDistribution(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { from: fromStr, to: toStr } = req.query as any;

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseDateRange(fromStr, toStr, 7);
  } catch (err) {
    return next(err);
  }

  const checks = await HealthCheck.find({
    workspaceId,
    completedAt: { $gte: dateRange.from, $lte: dateRange.to },
  })
    .select('statusCode')
    .lean();

  const distribution = calculateStatusCodeDistribution(checks as any);

  res.json({
    data: distribution,
    meta: {
      requestId: req.requestId || '',
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
  });
}
