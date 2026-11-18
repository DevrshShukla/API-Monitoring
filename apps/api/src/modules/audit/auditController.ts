import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditEvent } from '../../db/AuditEvent.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export async function listAuditEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = new mongoose.Types.ObjectId(req.workspaceId!);
  const { page = 1, limit = 50 } = req.query as any;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    AuditEvent.find({ workspaceId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('actorId', 'name email'),
    AuditEvent.countDocuments({ workspaceId }),
  ]);

  const data = events.map((e) => {
    const actor = e.actorId as any;
    return {
      id: e._id.toString(),
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      actor: actor ? { id: actor._id.toString(), name: actor.name, email: actor.email } : null,
      metadata: e.metadataSafe,
      createdAt: e.createdAt.toISOString(),
    };
  });

  res.json({
    data,
    meta: {
      requestId: req.requestId || '',
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: skip + events.length < total,
    },
  });
}
