import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AlertRule, IAlertRule } from '../../db/AlertRule.js';
import { Monitor } from '../../db/Monitor.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES, AlertRuleDto } from '@api-monitoring/shared';

function toAlertRuleDto(rule: IAlertRule, monitorName?: string | null): AlertRuleDto {
  return {
    id: rule._id.toString(),
    workspaceId: rule.workspaceId.toString(),
    monitorId: rule.monitorId ? rule.monitorId.toString() : null,
    monitorName,
    name: rule.name,
    enabled: rule.enabled,
    conditionType: rule.conditionType,
    operator: rule.operator,
    threshold: rule.threshold,
    consecutiveCount: rule.consecutiveCount,
    windowSize: rule.windowSize,
    severity: rule.severity,
    channels: rule.channels,
    cooldownMinutes: rule.cooldownMinutes,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function listAlertRules(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const rules = await AlertRule.find({ workspaceId }).sort({ createdAt: -1 }).populate('monitorId', 'name');

  const data = rules.map((r) => {
    const mon = r.monitorId as any;
    return toAlertRuleDto(r, mon ? mon.name : null);
  });

  res.json({
    data,
    meta: { requestId: req.requestId || '' },
  });
}

export async function createAlertRule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const {
    monitorId,
    name,
    enabled = true,
    conditionType,
    operator,
    threshold,
    consecutiveCount = 3,
    windowSize = 20,
    severity,
    channels,
    cooldownMinutes = 15,
  } = req.body;

  let validMonitorId: mongoose.Types.ObjectId | null = null;
  if (monitorId) {
    if (!mongoose.isValidObjectId(monitorId)) {
      return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found', 404));
    }
    const monitor = await Monitor.findOne({
      _id: new mongoose.Types.ObjectId(monitorId),
      workspaceId,
      deletedAt: null,
    });
    if (!monitor) {
      return next(new AppError(ERROR_CODES.NOT_FOUND, 'Monitor not found in workspace', 404));
    }
    validMonitorId = monitor._id;
  }

  const rule = await AlertRule.create({
    workspaceId,
    monitorId: validMonitorId,
    name: name.trim(),
    enabled,
    conditionType,
    operator,
    threshold,
    consecutiveCount,
    windowSize,
    severity,
    channels,
    cooldownMinutes,
  });

  res.status(201).json({
    data: toAlertRuleDto(rule),
    meta: { requestId: req.requestId || '' },
  });
}

export async function updateAlertRule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const ruleId = req.params.id as string;

  if (!ruleId || !mongoose.isValidObjectId(ruleId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Alert rule not found', 404));
  }

  const rule = await AlertRule.findOne({
    _id: new mongoose.Types.ObjectId(ruleId),
    workspaceId,
  });

  if (!rule) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Alert rule not found', 404));
  }

  const {
    name,
    enabled,
    conditionType,
    operator,
    threshold,
    consecutiveCount,
    windowSize,
    severity,
    channels,
    cooldownMinutes,
  } = req.body;

  if (name !== undefined) rule.name = name.trim();
  if (enabled !== undefined) rule.enabled = enabled;
  if (conditionType !== undefined) rule.conditionType = conditionType;
  if (operator !== undefined) rule.operator = operator;
  if (threshold !== undefined) rule.threshold = threshold;
  if (consecutiveCount !== undefined) rule.consecutiveCount = consecutiveCount;
  if (windowSize !== undefined) rule.windowSize = windowSize;
  if (severity !== undefined) rule.severity = severity;
  if (channels !== undefined) rule.channels = channels;
  if (cooldownMinutes !== undefined) rule.cooldownMinutes = cooldownMinutes;

  await rule.save();

  res.json({
    data: toAlertRuleDto(rule),
    meta: { requestId: req.requestId || '' },
  });
}

export async function deleteAlertRule(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const ruleId = req.params.id as string;

  if (!ruleId || !mongoose.isValidObjectId(ruleId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Alert rule not found', 404));
  }

  const result = await AlertRule.deleteOne({
    _id: new mongoose.Types.ObjectId(ruleId),
    workspaceId,
  });

  if (result.deletedCount === 0) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Alert rule not found', 404));
  }

  res.json({
    data: { message: 'Alert rule deleted successfully' },
    meta: { requestId: req.requestId || '' },
  });
}
