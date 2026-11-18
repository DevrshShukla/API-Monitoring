import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Notification } from '../db/Notification.js';
import { NotificationDelivery } from '../db/NotificationDelivery.js';
import { WorkspaceMember } from '../db/WorkspaceMember.js';
import { User } from '../db/User.js';
import { emitToWorkspace } from '../realtime/socket.js';
import { SOCKET_EVENTS, ALERT_CHANNEL } from '@api-monitoring/shared';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return transporter;
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export interface DispatchNotificationOptions {
  workspaceId: string;
  incidentId?: string | null;
  type: string;
  title: string;
  message: string;
  sendEmail?: boolean;
}

export async function dispatchNotification(options: DispatchNotificationOptions): Promise<void> {
  const { workspaceId, incidentId, type, title, message, sendEmail } = options;

  // 1. Find all active members of the workspace
  const members = await WorkspaceMember.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    status: 'active',
  }).populate('userId');

  for (const member of members) {
    const user = member.userId as any;
    if (!user || !user.email) continue;

    // 2. Persist In-App Notification
    const notif = await Notification.create({
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
      userId: user._id,
      incidentId: incidentId ? new mongoose.Types.ObjectId(incidentId) : null,
      type,
      title,
      message,
    });

    // 3. Emit real-time notification event
    emitToWorkspace(workspaceId, SOCKET_EVENTS.NOTIFICATION_CREATED, {
      id: notif._id.toString(),
      workspaceId,
      userId: user._id.toString(),
      incidentId: incidentId || null,
      type,
      title,
      message,
      createdAt: notif.createdAt,
    });

    // 4. Queue / Deliver Email if requested and configured
    if (sendEmail) {
      const masked = maskEmail(user.email);
      const delivery = await NotificationDelivery.create({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        notificationId: notif._id,
        channel: ALERT_CHANNEL.EMAIL,
        destinationMasked: masked,
        status: 'pending',
        attemptCount: 1,
      });

      const mailer = getTransporter();
      if (!mailer) {
        delivery.status = 'failed';
        delivery.lastErrorSafe = 'SMTP provider not configured';
        await delivery.save();
        logger.debug('Email notification skipped (SMTP not configured)', { destination: masked });
        continue;
      }

      try {
        await mailer.sendMail({
          from: env.SMTP_FROM,
          to: user.email,
          subject: `[API Monitor Alert] ${title}`,
          text: `${title}\n\n${message}\n\nTimestamp: ${new Date().toISOString()}`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2 style="color: #4338CA;">${title}</h2>
            <p style="font-size: 16px; color: #0F172A;">${message}</p>
            <p style="font-size: 12px; color: #64748B;">Timestamp: ${new Date().toUTCString()}</p>
          </div>`,
        });

        delivery.status = 'sent';
        delivery.sentAt = new Date();
        await delivery.save();
        logger.info('Notification email delivered successfully', { destination: masked });
      } catch (err: any) {
        delivery.status = 'failed';
        delivery.lastErrorSafe = err.message || 'SMTP delivery failure';
        await delivery.save();
        logger.warn('Failed to send notification email:', { error: err.message, destination: masked });
      }
    }
  }
}
