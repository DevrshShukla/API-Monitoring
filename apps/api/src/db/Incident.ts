import mongoose, { Schema, Document } from 'mongoose';
import {
  IncidentSeverity,
  INCIDENT_SEVERITY,
  IncidentStatus,
  INCIDENT_STATUS,
} from '@api-monitoring/shared';

export interface IIncident extends Document {
  workspaceId: mongoose.Types.ObjectId;
  monitorId: mongoose.Types.ObjectId;
  alertRuleId: mongoose.Types.ObjectId | null;
  fingerprint: string;
  title: string;
  description: string;
  conditionType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  openedAt: Date;
  acknowledgedAt: Date | null;
  investigatingAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: mongoose.Types.ObjectId | null;
  resolutionNote: string | null;
  lastTriggeredAt: Date;
  lastNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IncidentSchema = new Schema<IIncident>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'Monitor', required: true },
    alertRuleId: { type: Schema.Types.ObjectId, ref: 'AlertRule', default: null },
    fingerprint: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    conditionType: { type: String, required: true },
    severity: {
      type: String,
      enum: Object.values(INCIDENT_SEVERITY),
      default: INCIDENT_SEVERITY.HIGH,
    },
    status: {
      type: String,
      enum: Object.values(INCIDENT_STATUS),
      default: INCIDENT_STATUS.OPEN,
    },
    openedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    investigatingAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolutionNote: { type: String, default: null },
    lastTriggeredAt: { type: Date, default: Date.now },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes
IncidentSchema.index({ workspaceId: 1, status: 1, openedAt: -1 });
IncidentSchema.index({ workspaceId: 1, severity: 1, openedAt: -1 });
IncidentSchema.index({ workspaceId: 1, fingerprint: 1, status: 1 });

export const Incident = mongoose.model<IIncident>('Incident', IncidentSchema);
