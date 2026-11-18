import mongoose from 'mongoose';
import { IMonitor } from '../db/Monitor.js';
import { IHealthCheck, HealthCheck } from '../db/HealthCheck.js';
import { AlertRule, IAlertRule } from '../db/AlertRule.js';
import { Incident, IIncident } from '../db/Incident.js';
import { IncidentEvent } from '../db/IncidentEvent.js';
import { dispatchNotification } from './notificationService.js';
import { emitToWorkspace } from '../realtime/socket.js';
import { logger } from '../config/logger.js';
import {
  ALERT_CONDITION_TYPE,
  ALERT_CHANNEL,
  INCIDENT_STATUS,
  SOCKET_EVENTS,
  CHECK_OUTCOME,
} from '@api-monitoring/shared';

export interface AlertEvaluationContext {
  monitor: IMonitor;
  latestCheck: IHealthCheck;
}

export async function evaluateAlertRules(context: AlertEvaluationContext): Promise<void> {
  const { monitor, latestCheck } = context;
  const workspaceId = monitor.workspaceId.toString();
  const monitorId = monitor._id.toString();

  // 1. Fetch all enabled alert rules for this monitor or workspace-wide
  const rules = await AlertRule.find({
    workspaceId: monitor.workspaceId,
    enabled: true,
    $or: [{ monitorId: monitor._id }, { monitorId: null }],
  });

  if (rules.length === 0) {
    return;
  }

  // Fetch recent check history for window-based rules
  const recentChecks = await HealthCheck.find({
    workspaceId: monitor.workspaceId,
    monitorId: monitor._id,
  })
    .sort({ completedAt: -1 })
    .limit(50)
    .lean();

  for (const rule of rules) {
    let triggered = false;
    let explanation = '';

    if (rule.conditionType === ALERT_CONDITION_TYPE.CONSECUTIVE_FAILURES) {
      if (monitor.consecutiveFailures >= rule.threshold) {
        triggered = true;
        explanation = `Monitor has failed ${monitor.consecutiveFailures} consecutive times (threshold: ${rule.threshold})`;
      }
    } else if (rule.conditionType === ALERT_CONDITION_TYPE.LATENCY_THRESHOLD) {
      if (latestCheck.outcome === CHECK_OUTCOME.SUCCESS && latestCheck.latencyMs > rule.threshold) {
        // Check consecutive latency breach
        const countNeeded = rule.consecutiveCount || 1;
        const recentSuccesses = recentChecks
          .filter((c) => c.outcome === CHECK_OUTCOME.SUCCESS)
          .slice(0, countNeeded);

        if (
          recentSuccesses.length >= countNeeded &&
          recentSuccesses.every((c) => c.latencyMs > rule.threshold)
        ) {
          triggered = true;
          explanation = `Monitor latency was ${latestCheck.latencyMs}ms for ${countNeeded} consecutive checks (threshold: ${rule.threshold}ms)`;
        }
      }
    } else if (rule.conditionType === ALERT_CONDITION_TYPE.ERROR_RATE) {
      const window = rule.windowSize || 20;
      const sample = recentChecks.slice(0, window);
      if (sample.length >= Math.min(window, 5)) {
        const failures = sample.filter((c) => c.outcome !== CHECK_OUTCOME.SUCCESS).length;
        const failureRate = (failures / sample.length) * 100;
        if (failureRate >= rule.threshold) {
          triggered = true;
          explanation = `Error rate is ${Math.round(failureRate)}% over the last ${sample.length} checks (threshold: ${rule.threshold}%)`;
        }
      }
    }

    if (triggered) {
      await handleTriggeredRule(monitor, rule, explanation);
    }
  }
}

async function handleTriggeredRule(
  monitor: IMonitor,
  rule: IAlertRule,
  explanation: string
): Promise<void> {
  const workspaceId = monitor.workspaceId.toString();
  const monitorId = monitor._id.toString();
  const fingerprint = `${workspaceId}:${monitorId}:${rule._id.toString()}:${rule.conditionType}`;
  const now = new Date();

  // 1. Check for existing active incident with this fingerprint
  let incident = await Incident.findOne({
    workspaceId: monitor.workspaceId,
    fingerprint,
    status: { $in: [INCIDENT_STATUS.OPEN, INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.INVESTIGATING] },
  });

  const cooldownMs = (rule.cooldownMinutes || 15) * 60 * 1000;

  if (incident) {
    // Update lastTriggeredAt
    incident.lastTriggeredAt = now;

    // Check cooldown for notification suppression
    const lastNotified = incident.lastNotifiedAt ? new Date(incident.lastNotifiedAt).getTime() : 0;
    const cooldownActive = now.getTime() - lastNotified < cooldownMs;

    if (!cooldownActive) {
      incident.lastNotifiedAt = now;
      await incident.save();

      // Dispatch repeated notification after cooldown elapsed
      await dispatchNotification({
        workspaceId,
        incidentId: incident._id.toString(),
        type: 'INCIDENT_TRIGGERED',
        title: `Incident Alert: ${incident.title}`,
        message: `${explanation} (Cooldown elapsed, issue persists)`,
        sendEmail: rule.channels.includes(ALERT_CHANNEL.EMAIL),
      });
    } else {
      await incident.save();
      logger.debug('Notification suppressed due to active cooldown', {
        fingerprint,
        cooldownMinutes: rule.cooldownMinutes,
      });
    }

    emitToWorkspace(workspaceId, SOCKET_EVENTS.INCIDENT_UPDATED, {
      incidentId: incident._id.toString(),
      status: incident.status,
      lastTriggeredAt: incident.lastTriggeredAt,
    });
  } else {
    // Create new Incident
    const title = `${monitor.name} — ${rule.name || rule.conditionType}`;
    incident = await Incident.create({
      workspaceId: monitor.workspaceId,
      monitorId: monitor._id,
      alertRuleId: rule._id,
      fingerprint,
      title,
      description: explanation,
      conditionType: rule.conditionType,
      severity: rule.severity,
      status: INCIDENT_STATUS.OPEN,
      openedAt: now,
      lastTriggeredAt: now,
      lastNotifiedAt: now,
    });

    // Create Initial Incident Event
    await IncidentEvent.create({
      workspaceId: monitor.workspaceId,
      incidentId: incident._id,
      actorType: 'system',
      actorId: null,
      actorName: 'System Monitor Engine',
      eventType: 'CREATED',
      message: `Incident created: ${explanation}`,
      metadataSafe: {
        conditionType: rule.conditionType,
        severity: rule.severity,
        threshold: rule.threshold,
      },
    });

    // Dispatch Notifications (in-app + email if configured)
    await dispatchNotification({
      workspaceId,
      incidentId: incident._id.toString(),
      type: 'INCIDENT_OPENED',
      title: `Incident: ${title}`,
      message: explanation,
      sendEmail: rule.channels.includes(ALERT_CHANNEL.EMAIL),
    });

    emitToWorkspace(workspaceId, SOCKET_EVENTS.INCIDENT_CREATED, {
      id: incident._id.toString(),
      workspaceId,
      monitorId,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      openedAt: incident.openedAt,
    });
  }
}
