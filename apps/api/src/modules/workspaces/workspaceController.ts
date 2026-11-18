import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Workspace } from '../../db/Workspace.js';
import { WorkspaceMember } from '../../db/WorkspaceMember.js';
import { User } from '../../db/User.js';
import { AuditEvent } from '../../db/AuditEvent.js';
import { withTransaction } from '../../config/db.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES, WORKSPACE_ROLE, WorkspaceRole } from '@api-monitoring/shared';

export async function listWorkspaces(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const memberships = await WorkspaceMember.find({
    userId: new mongoose.Types.ObjectId(req.user!.id),
    status: 'active',
  }).populate('workspaceId');

  const data = memberships
    .filter((m) => m.workspaceId)
    .map((m) => {
      const ws = m.workspaceId as any;
      return {
        id: ws._id.toString(),
        name: ws.name,
        slug: ws.slug,
        role: m.role,
        plan: ws.plan,
        createdAt: ws.createdAt.toISOString(),
      };
    });

  res.json({
    data,
    meta: { requestId: req.requestId || '' },
  });
}

export async function createWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Workspace name must be at least 2 characters', 400));
  }

  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;

  try {
    const workspace = await withTransaction(async (session) => {
      const ws = new Workspace({
        name: name.trim(),
        slug,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        plan: 'free',
      });
      if (session) await ws.save({ session });
      else await ws.save();

      const member = new WorkspaceMember({
        workspaceId: ws._id,
        userId: new mongoose.Types.ObjectId(req.user!.id),
        role: WORKSPACE_ROLE.OWNER,
        status: 'active',
      });
      if (session) await member.save({ session });
      else await member.save();

      if (session) {
        await AuditEvent.create(
          [
            {
              workspaceId: ws._id,
              actorId: new mongoose.Types.ObjectId(req.user!.id),
              action: 'WORKSPACE_CREATED',
              resourceType: 'workspace',
              resourceId: ws._id.toString(),
              metadataSafe: { name: ws.name, slug: ws.slug },
            },
          ],
          { session }
        );
      } else {
        await AuditEvent.create({
          workspaceId: ws._id,
          actorId: new mongoose.Types.ObjectId(req.user!.id),
          action: 'WORKSPACE_CREATED',
          resourceType: 'workspace',
          resourceId: ws._id.toString(),
          metadataSafe: { name: ws.name, slug: ws.slug },
        });
      }

      return ws;
    });

    res.status(201).json({
      data: {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug,
        role: WORKSPACE_ROLE.OWNER,
        plan: workspace.plan,
        createdAt: workspace.createdAt.toISOString(),
      },
      meta: { requestId: req.requestId || '' },
    });
  } catch (error) {
    next(error);
  }
}

export async function getWorkspace(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = req.params.id as string;
  if (!workspaceId || !mongoose.isValidObjectId(workspaceId)) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Workspace not found', 404));
  }

  const member = await WorkspaceMember.findOne({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    userId: new mongoose.Types.ObjectId(req.user!.id),
    status: 'active',
  }).populate('workspaceId');

  if (!member || !member.workspaceId) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'Workspace not found', 404));
  }

  const ws = member.workspaceId as any;
  res.json({
    data: {
      id: ws._id.toString(),
      name: ws.name,
      slug: ws.slug,
      role: member.role,
      plan: ws.plan,
      settings: ws.settings,
      createdAt: ws.createdAt.toISOString(),
    },
    meta: { requestId: req.requestId || '' },
  });
}

export async function listMembers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = req.workspaceId!;
  const members = await WorkspaceMember.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
  }).populate('userId', 'email name');

  const data = members.map((m) => {
    const u = m.userId as any;
    return {
      id: m._id.toString(),
      userId: u ? u._id.toString() : null,
      email: u ? u.email : 'Unknown',
      name: u ? u.name : 'Unknown',
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    };
  });

  res.json({
    data,
    meta: { requestId: req.requestId || '' },
  });
}

export async function addMember(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const workspaceId = req.workspaceId!;
  const { email, role } = req.body;

  if (!email || typeof email !== 'string') {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Valid email is required', 400));
  }

  const targetRole = role || WORKSPACE_ROLE.MEMBER;
  if (!Object.values(WORKSPACE_ROLE).includes(targetRole) || targetRole === WORKSPACE_ROLE.OWNER) {
    return next(new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid role assignment', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'User with that email not found. User must register first.', 404));
  }

  const existingMember = await WorkspaceMember.findOne({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    userId: user._id,
  });

  if (existingMember) {
    return next(new AppError(ERROR_CODES.CONFLICT, 'User is already a member of this workspace', 409));
  }

  const newMember = await WorkspaceMember.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    userId: user._id,
    role: targetRole,
    status: 'active',
  });

  await AuditEvent.create({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    actorId: new mongoose.Types.ObjectId(req.user!.id),
    action: 'MEMBER_ADDED',
    resourceType: 'member',
    resourceId: newMember._id.toString(),
    metadataSafe: { email: user.email, role: targetRole },
  });

  res.status(201).json({
    data: {
      id: newMember._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: newMember.role,
      status: newMember.status,
      joinedAt: newMember.joinedAt.toISOString(),
    },
    meta: { requestId: req.requestId || '' },
  });
}
