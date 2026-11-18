import mongoose, { Schema, Document } from 'mongoose';
import { AlertChannel, ALERT_CHANNEL } from '@api-monitoring/shared';

export interface INotificationDelivery extends Document {
  workspaceId: mongoose.Types.ObjectId;
  notificationId: mongoose.Types.ObjectId;
  channel: AlertChannel;
  destinationMasked: string;
  status: 'pending' | 'sent' | 'failed';
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastErrorSafe: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationDeliverySchema = new Schema<INotificationDelivery>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    notificationId: { type: Schema.Types.ObjectId, ref: 'Notification', required: true },
    channel: { type: String, enum: Object.values(ALERT_CHANNEL), default: ALERT_CHANNEL.EMAIL },
    destinationMasked: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attemptCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastErrorSafe: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationDeliverySchema.index({ status: 1, nextAttemptAt: 1 });
NotificationDeliverySchema.index({ workspaceId: 1, createdAt: -1 });

export const NotificationDelivery = mongoose.model<INotificationDelivery>(
  'NotificationDelivery',
  NotificationDeliverySchema
);
