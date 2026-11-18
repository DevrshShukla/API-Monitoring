import mongoose, { Schema, Document } from 'mongoose';
import {
  AlertConditionType,
  ALERT_CONDITION_TYPE,
  AlertOperator,
  ALERT_OPERATOR,
  AlertChannel,
  ALERT_CHANNEL,
  IncidentSeverity,
  INCIDENT_SEVERITY,
  CONFIG_DEFAULTS,
} from '@api-monitoring/shared';

export interface IAlertRule extends Document {
  workspaceId: mongoose.Types.ObjectId;
  monitorId: mongoose.Types.ObjectId | null; // null means applies to all monitors in workspace
  name: string;
  enabled: boolean;
  conditionType: AlertConditionType;
  operator: AlertOperator;
  threshold: number;
  consecutiveCount: number;
  windowSize: number;
  severity: IncidentSeverity;
  channels: AlertChannel[];
  cooldownMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlertRuleSchema = new Schema<IAlertRule>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    monitorId: { type: Schema.Types.ObjectId, ref: 'Monitor', default: null },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    conditionType: {
      type: String,
      enum: Object.values(ALERT_CONDITION_TYPE),
      required: true,
    },
    operator: {
      type: String,
      enum: Object.values(ALERT_OPERATOR),
      required: true,
    },
    threshold: { type: Number, required: true },
    consecutiveCount: { type: Number, default: 3 },
    windowSize: { type: Number, default: 20 },
    severity: {
      type: String,
      enum: Object.values(INCIDENT_SEVERITY),
      default: INCIDENT_SEVERITY.HIGH,
    },
    channels: {
      type: [String],
      enum: Object.values(ALERT_CHANNEL),
      default: [ALERT_CHANNEL.IN_APP],
    },
    cooldownMinutes: {
      type: Number,
      default: CONFIG_DEFAULTS.NOTIFICATION_COOLDOWN_MINUTES,
    },
  },
  { timestamps: true }
);

AlertRuleSchema.index({ workspaceId: 1, enabled: 1 });
AlertRuleSchema.index({ workspaceId: 1, monitorId: 1 });

export const AlertRule = mongoose.model<IAlertRule>('AlertRule', AlertRuleSchema);
