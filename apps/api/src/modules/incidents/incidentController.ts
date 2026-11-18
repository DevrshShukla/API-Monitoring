import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Incident, IIncident } from '../../db/Incident.js';
import { IncidentEvent } from '../../db/IncidentEvent.js';
import { Monitor } from '../../db/Monitor.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emitToWorkspace } from '../../realtime/socket.js';
import {
  ERROR_CODES,
  INCIDENT_STATUS,
  SOCKET_EVENTS,
  IncidentDto,
  IncidentEventDto,
} from '@api-monitoring/shared';

function toIncidentDto(incident: IIncident, monitor?: { name: string; url: string } | null, timeline?: IncidentEventDto[]): IncidentDto {
  return {
    id: incident._id.toString(),
    workspaceId: incident.workspaceId.toString(),
    monitorId: incident.monitorId.toString(),
    monitorName: monitor?.name,
    monitorUrl: monitor?.url,
    alertRuleId: incident.alertRuleId ? incident.alertRuleId.toString() : null,
    fingerprint: incident.fingerprint,
    title: incident.title,
    description: incident.description,
    conditionType: incident.conditionType,
    severity: incident.severity,
    status: incident.status,
    openedAt: incident.openedAt.toISOString(),
    acknowledgedAt: incident.acknowledgedAt ? incident.acknowledgedAt.toISOString() : null,
    investigatingAt: incident.investigatingAt ? incident.investigatingAt.toISOString() : null,
    resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
    resolvedBy: incident.resolvedBy ? incident.resolvedBy.toString() : null,
    resolutionNote: incident.resolutionNote,
    lastTriggeredAt: incident.lastTriggeredAt.toISOString(),
    timeline,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

export async function listIncidents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { page = 1, limit = 20, status, severity, monitorId } = req.query as any;

  const query: any = { workspaceId };
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (monitorId && mongoose.isValidObjectId(monitorId)) {
    query.monitorId = new mongoose.Types.ObjectId(monitorId);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [incidents, total] = await Promise.all([
    Incident.find(query).sort({ openedAt: -1 }).skip(skip).limit(limitNum).populate('monitorId', 'name url'),
    Incident.countDocuments(query),
  ]);

  const data = incidents.map((inc) => {
    const mon = inc.monitorId as any;
    return toIncidentDto(inc, mon ? { name: mon.name, url: mon.url } : null);
  });

  res.json({
    data,
    meta: {
      requestId: req.requestId || '',
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + incidents.length < total,
    },
  });
}

export async function getIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const incidentId = req.params.id as string;

  if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  const incident = await Incident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    workspaceId,
  }).populate('monitorId', 'name url');

  if (!incident) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  const events = await IncidentEvent.find({
    workspaceId,
    incidentId: incident._id,
  }).sort({ createdAt: 1 });

  const timeline: IncidentEventDto[] = events.map((e) => ({
    id: e._id.toString(),
    incidentId: e.incidentId.toString(),
    actorType: e.actorType,
    actorId: e.actorId ? e.actorId.toString() : null,
    actorName: e.actorName,
    eventType: e.eventType,
    message: e.message,
    metadataSafe: e.metadataSafe,
    createdAt: e.createdAt.toISOString(),
  }));

  const mon = incident.monitorId as any;
  res.json({
    data: toIncidentDto(incident, mon ? { name: mon.name, url: mon.url } : null, timeline),
    meta: { requestId: req.requestId || '' },
  });
}

export async function acknowledgeIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const incidentId = req.params.id as string;

  if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  const incident = await Incident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    workspaceId,
  });

  if (!incident) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  if (incident.status === INCIDENT_STATUS.RESOLVED) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot acknowledge a resolved incident', 400));
  }

  incident.status = INCIDENT_STATUS.ACKNOWLEDGED;
  incident.acknowledgedAt = new Date();
  await incident.save();

  await IncidentEvent.create({
    workspaceId,
    incidentId: incident._id,
    actorType: 'user',
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    eventType: 'ACKNOWLEDGED',
    message: `Incident acknowledged by ${req.user!.name}`,
  });

  emitToWorkspace(workspaceId.toString(), SOCKET_EVENTS.INCIDENT_UPDATED, {
    incidentId: incident._id.toString(),
    status: incident.status,
    acknowledgedAt: incident.acknowledgedAt,
  });

  res.json({
    data: toIncidentDto(incident),
    meta: { requestId: req.requestId || '' },
  });
}

export async function investigateIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const incidentId = req.params.id as string;

  if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  const incident = await Incident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    workspaceId,
  });

  if (!incident) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  if (incident.status === INCIDENT_STATUS.RESOLVED) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Cannot investigate a resolved incident', 400));
  }

  incident.status = INCIDENT_STATUS.INVESTIGATING;
  incident.investigatingAt = new Date();
  await incident.save();

  await IncidentEvent.create({
    workspaceId,
    incidentId: incident._id,
    actorType: 'user',
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    eventType: 'INVESTIGATING',
    message: `Investigation started by ${req.user!.name}`,
  });

  emitToWorkspace(workspaceId.toString(), SOCKET_EVENTS.INCIDENT_UPDATED, {
    incidentId: incident._id.toString(),
    status: incident.status,
    investigatingAt: incident.investigatingAt,
  });

  res.json({
    data: toIncidentDto(incident),
    meta: { requestId: req.requestId || '' },
  });
}

export async function resolveIncident(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const incidentId = req.params.id as string;
  const { resolutionNote } = req.body;

  if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  if (!resolutionNote || resolutionNote.trim().length < 5) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Resolution note is required (min 5 characters)', 400));
  }

  const incident = await Incident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    workspaceId,
  });

  if (!incident) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  incident.status = INCIDENT_STATUS.RESOLVED;
  incident.resolvedAt = new Date();
  incident.resolvedBy = new mongoose.Types.ObjectId(req.user!.id);
  incident.resolutionNote = resolutionNote.trim();
  await incident.save();

  await IncidentEvent.create({
    workspaceId,
    incidentId: incident._id,
    actorType: 'user',
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    eventType: 'RESOLVED',
    message: `Incident resolved: ${resolutionNote.trim()}`,
  });

  emitToWorkspace(workspaceId.toString(), SOCKET_EVENTS.INCIDENT_UPDATED, {
    incidentId: incident._id.toString(),
    status: incident.status,
    resolvedAt: incident.resolvedAt,
    resolutionNote: incident.resolutionNote,
  });

  res.json({
    data: toIncidentDto(incident),
    meta: { requestId: req.requestId || '' },
  });
}

export async function addIncidentNote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const incidentId = req.params.id as string;
  const { note } = req.body;

  if (!incidentId || !mongoose.isValidObjectId(incidentId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  if (!note || note.trim().length === 0) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Note text is required', 400));
  }

  const incident = await Incident.findOne({
    _id: new mongoose.Types.ObjectId(incidentId),
    workspaceId,
  });

  if (!incident) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Incident not found', 404));
  }

  const event = await IncidentEvent.create({
    workspaceId,
    incidentId: incident._id,
    actorType: 'user',
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    actorName: req.user!.name,
    eventType: 'NOTE_ADDED',
    message: note.trim(),
  });

  res.status(201).json({
    data: {
      id: event._id.toString(),
      incidentId: incident._id.toString(),
      actorType: event.actorType,
      actorName: event.actorName,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    },
    meta: { requestId: req.requestId || '' },
  });
}
