import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../../db/Notification.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES, NotificationDto } from '@api-monitoring/shared';

export async function listNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const userId = new mongoose.Types.ObjectId(req.user!.id);

  const notifications = await Notification.find({
    workspaceId,
    userId,
  })
    .sort({ createdAt: -1 })
    .limit(50);

  const data: NotificationDto[] = notifications.map((n) => ({
    id: n._id.toString(),
    workspaceId: n.workspaceId.toString(),
    userId: n.userId.toString(),
    incidentId: n.incidentId ? n.incidentId.toString() : null,
    type: n.type,
    title: n.title,
    message: n.message,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  res.json({
    data,
    meta: { requestId: req.requestId || '' },
  });
}

export async function markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const userId = new mongoose.Types.ObjectId(req.user!.id);
  const notifId = req.params.id as string;

  if (!notifId || !mongoose.isValidObjectId(notifId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Notification not found', 404));
  }

  const notification = await Notification.findOne({
    _id: new mongoose.Types.ObjectId(notifId),
    workspaceId,
    userId,
  });

  if (!notification) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Notification not found', 404));
  }

  notification.readAt = new Date();
  await notification.save();

  res.json({
    data: {
      id: notification._id.toString(),
      readAt: notification.readAt.toISOString(),
    },
    meta: { requestId: req.requestId || '' },
  });
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const userId = new mongoose.Types.ObjectId(req.user!.id);

  await Notification.updateMany(
    { workspaceId, userId, readAt: null },
    { readAt: new Date() }
  );

  res.json({
    data: { message: 'All notifications marked as read' },
    meta: { requestId: req.requestId || '' },
  });
}
