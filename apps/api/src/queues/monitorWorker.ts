import { Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisConnection } from '../config/redis.js';
import { CHECK_QUEUE_NAME } from './queue.js';
import { Monitor } from '../db/Monitor.js';
import { HealthCheck } from '../db/HealthCheck.js';
import { executeSafeRequest } from '../services/safeHttpClient.js';
import { decryptObject, decryptString } from '../services/cryptoService.js';
import { computeMonitorStatus } from '../services/statusCalculator.js';
import { evaluateAlertRules } from '../services/alertEngine.js';
import { emitToWorkspace } from '../realtime/socket.js';
import { logger } from '../config/logger.js';
import {
  CHECK_OUTCOME,
  SOCKET_EVENTS,
  CONFIG_DEFAULTS,
  MonitorHeaderItem,
} from '@api-monitoring/shared';

export interface MonitorCheckJobData {
  monitorId: string;
  scheduledAt: string;
}

export function startMonitorWorker(): Worker {
  const worker = new Worker(
    CHECK_QUEUE_NAME,
    async (job: Job<MonitorCheckJobData>) => {
      const { monitorId, scheduledAt } = job.data;
      const scheduledDate = new Date(scheduledAt || Date.now());

      logger.debug(`Worker processing job ${job.id} for monitor ${monitorId}`);

      // 1. Re-read fresh monitor configuration from database
      const monitor = await Monitor.findById(monitorId);
      if (!monitor || !monitor.active || monitor.deletedAt) {
        logger.debug(`Monitor ${monitorId} is inactive, deleted or missing. Skipping check.`);
        return { skipped: true, reason: 'inactive_or_missing' };
      }

      // 2. Decrypt sensitive headers and body if present
      let decryptedHeaders: Record<string, string> = {};
      if (monitor.headersEncrypted) {
        try {
          const headerList = decryptObject<MonitorHeaderItem[]>(monitor.headersEncrypted);
          for (const h of headerList) {
            decryptedHeaders[h.key] = h.value;
          }
        } catch (err: any) {
          logger.warn(`Failed to decrypt headers for monitor ${monitorId}:`, { error: err.message });
        }
      }

      let decryptedBody: string | undefined = undefined;
      if (monitor.bodyEncrypted) {
        try {
          decryptedBody = decryptString(monitor.bodyEncrypted);
        } catch (err: any) {
          logger.warn(`Failed to decrypt body for monitor ${monitorId}:`, { error: err.message });
        }
      }

      // 3. Execute Outbound HTTP Check with SSRF protection and latency tracking
      const checkResult = await executeSafeRequest({
        url: monitor.url,
        method: monitor.method,
        timeoutMs: monitor.timeoutMs,
        expectedStatusCodes: monitor.expectedStatusCodes,
        headers: decryptedHeaders,
        body: decryptedBody,
        bodyContentType: monitor.bodyContentType,
      });

      // 4. Persist Immutable HealthCheck
      const check = await HealthCheck.create({
        workspaceId: monitor.workspaceId,
        monitorId: monitor._id,
        scheduledAt: scheduledDate,
        startedAt: checkResult.startedAt,
        completedAt: checkResult.completedAt,
        outcome: checkResult.outcome,
        statusCode: checkResult.statusCode,
        latencyMs: checkResult.latencyMs,
        errorCategory: checkResult.errorCategory,
        errorMessageSafe: checkResult.errorMessageSafe,
        responseBytes: checkResult.responseBytes,
        traceId: job.id || null,
      });

      // 5. Calculate Consecutive Failures & Rolling Ratio
      const isSuccess = checkResult.outcome === CHECK_OUTCOME.SUCCESS;
      const newConsecutiveFailures = isSuccess ? 0 : monitor.consecutiveFailures + 1;

      // Query recent checks to compute success ratio
      const recentChecks = await HealthCheck.find({
        workspaceId: monitor.workspaceId,
        monitorId: monitor._id,
      })
        .sort({ completedAt: -1 })
        .limit(CONFIG_DEFAULTS.RECENT_CHECKS_WINDOW)
        .select('outcome')
        .lean();

      const successCount = recentChecks.filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS).length;
      const recentSuccessRatio =
        recentChecks.length > 0
          ? Math.round((successCount / recentChecks.length) * 100) / 100
          : 1.0;

      // 6. Compute New Status
      const priorStatus = monitor.status;
      const computedStatus = computeMonitorStatus({
        active: monitor.active,
        latestOutcome: checkResult.outcome,
        latestLatencyMs: checkResult.latencyMs,
        consecutiveFailures: newConsecutiveFailures,
        recentSuccessRatio,
        latencyThresholdMs: monitor.latencyThresholdMs,
        failuresToDownThreshold: CONFIG_DEFAULTS.FAILURES_TO_DOWN,
        previousStatus: priorStatus,
      });

      // 7. Calculate nextRunAt with ±10% jitter
      const intervalMs = monitor.intervalSeconds * 1000;
      const jitterFactor = 0.9 + Math.random() * 0.2; // 0.90 to 1.10
      const nextRunAt = new Date(Date.now() + Math.round(intervalMs * jitterFactor));

      // 8. Atomically update monitor summary
      monitor.lastStatus = priorStatus;
      monitor.status = computedStatus;
      monitor.lastCheckedAt = checkResult.completedAt;
      monitor.lastLatencyMs = checkResult.latencyMs;
      monitor.consecutiveFailures = newConsecutiveFailures;
      monitor.recentSuccessRatio = recentSuccessRatio;
      monitor.nextRunAt = nextRunAt;
      await monitor.save();

      // 9. Evaluate Alert Rules & Incidents
      await evaluateAlertRules({ monitor, latestCheck: check });

      // 10. Emit Realtime Events to Workspace
      const workspaceIdStr = monitor.workspaceId.toString();

      emitToWorkspace(workspaceIdStr, SOCKET_EVENTS.MONITOR_CHECK_COMPLETED, {
        monitorId: monitor._id.toString(),
        checkId: check._id.toString(),
        outcome: check.outcome,
        statusCode: check.statusCode,
        latencyMs: check.latencyMs,
        completedAt: check.completedAt,
      });

      if (priorStatus !== computedStatus) {
        emitToWorkspace(workspaceIdStr, SOCKET_EVENTS.MONITOR_STATUS_UPDATED, {
          monitorId: monitor._id.toString(),
          status: computedStatus,
          lastStatus: priorStatus,
          lastCheckedAt: monitor.lastCheckedAt,
        });
      }

      logger.info(
        `Check complete: ${monitor.name} [${monitor.method} ${monitor.url}] => ${check.outcome} (${check.latencyMs}ms, status: ${computedStatus})`
      );

      return {
        checkId: check._id.toString(),
        outcome: check.outcome,
        status: computedStatus,
      };
    },
    {
      connection: getRedisConnection(),
      concurrency: 10,
    }
  );

  worker.on('error', (err) => {
    logger.error('Monitor worker error:', { error: err.message });
  });

  logger.info('Monitor worker started with concurrency 10');
  return worker;
}
