import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { User } from '../../db/User.js';
import { Workspace } from '../../db/Workspace.js';
import { WorkspaceMember } from '../../db/WorkspaceMember.js';
import { RefreshToken } from '../../db/RefreshToken.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ERROR_CODES, WORKSPACE_ROLE } from '@api-monitoring/shared';
import { AuthenticatedRequest } from '../../middleware/auth.js';

import { withTransaction } from '../../config/db.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(userId: string, email: string, familyId?: string) {
  const accessToken = jwt.sign(
    { sub: userId, email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const tokenFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  return { accessToken, rawRefreshToken, tokenHash, tokenFamilyId, expiresAt };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { email, password, name, workspaceName } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new AppError(ERROR_CODES.CONFLICT, 'An account with this email already exists', 409));
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  try {
    const result = await withTransaction(async (session) => {
      const user = new User({
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
      });
      if (session) await user.save({ session });
      else await user.save();

      const baseSlug = (workspaceName || `${name.trim()}'s Workspace`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);
      const slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;

      const workspace = new Workspace({
        name: workspaceName || `${name.trim()}'s Workspace`,
        slug,
        createdBy: user._id,
        plan: 'free',
      });
      if (session) await workspace.save({ session });
      else await workspace.save();

      const member = new WorkspaceMember({
        workspaceId: workspace._id,
        userId: user._id,
        role: WORKSPACE_ROLE.OWNER,
        status: 'active',
      });
      if (session) await member.save({ session });
      else await member.save();

      const { accessToken, rawRefreshToken, tokenHash, tokenFamilyId, expiresAt } = generateTokens(
        user._id.toString(),
        user.email
      );

      if (session) {
        await RefreshToken.create(
          [
            {
              userId: user._id,
              tokenHash,
              familyId: tokenFamilyId,
              expiresAt,
            },
          ],
          { session }
        );
      } else {
        await RefreshToken.create({
          userId: user._id,
          tokenHash,
          familyId: tokenFamilyId,
          expiresAt,
        });
      }

      return {
        accessToken,
        rawRefreshToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
        },
        workspace: {
          id: workspace._id.toString(),
          name: workspace.name,
          slug: workspace.slug,
          role: WORKSPACE_ROLE.OWNER,
          plan: workspace.plan,
          createdAt: workspace.createdAt.toISOString(),
        },
      };
    });

    res.status(201).json({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.rawRefreshToken,
        user: result.user,
        workspace: result.workspace,
      },
      meta: { requestId: (req as any).requestId },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { email, password } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password', 401));
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password', 401));
  }

  const member = await WorkspaceMember.findOne({ userId: user._id, status: 'active' }).populate('workspaceId');
  if (!member || !member.workspaceId) {
    return next(new AppError(ERROR_CODES.FORBIDDEN, 'User does not belong to any active workspace', 403));
  }

  const workspace = member.workspaceId as any;

  const { accessToken, rawRefreshToken, tokenHash, tokenFamilyId, expiresAt } = generateTokens(
    user._id.toString(),
    user.email
  );

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    familyId: tokenFamilyId,
    expiresAt,
  });

  res.json({
    data: {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      workspace: {
        id: workspace._id.toString(),
        name: workspace.name,
        slug: workspace.slug,
        role: member.role,
        plan: workspace.plan,
        createdAt: workspace.createdAt.toISOString(),
      },
    },
    meta: { requestId: (req as any).requestId },
  });
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { refreshToken: rawToken } = req.body;
  if (!rawToken) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Refresh token is required', 401));
  }

  const tokenHash = hashToken(rawToken);
  const foundToken = await RefreshToken.findOne({ tokenHash });

  if (!foundToken) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid refresh token', 401));
  }

  // Token reuse detection (ADR-006)
  if (foundToken.revokedAt) {
    // Family compromise suspected: revoke entire token family!
    await RefreshToken.updateMany({ familyId: foundToken.familyId }, { revokedAt: new Date() });
    return next(
      new AppError(ERROR_CODES.UNAUTHENTICATED, 'Refresh token reuse detected. Session revoked.', 401)
    );
  }

  if (foundToken.expiresAt < new Date()) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Refresh token expired', 401));
  }

  // Mark current token revoked and rotate to new one
  foundToken.revokedAt = new Date();
  await foundToken.save();

  const user = await User.findById(foundToken.userId);
  if (!user || user.status !== 'active') {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'User account is inactive', 401));
  }

  const { accessToken, rawRefreshToken, tokenHash: newHash, tokenFamilyId, expiresAt } = generateTokens(
    user._id.toString(),
    user.email,
    foundToken.familyId
  );

  await RefreshToken.create({
    userId: user._id,
    tokenHash: newHash,
    familyId: tokenFamilyId,
    expiresAt,
  });

  res.json({
    data: {
      accessToken,
      refreshToken: rawRefreshToken,
    },
    meta: { requestId: (req as any).requestId },
  });
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { refreshToken: rawToken } = req.body;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const foundToken = await RefreshToken.findOne({ tokenHash });
    if (foundToken) {
      await RefreshToken.updateMany({ familyId: foundToken.familyId }, { revokedAt: new Date() });
    }
  }

  res.json({
    data: { message: 'Logged out successfully' },
    meta: { requestId: (req as any).requestId },
  });
}

export async function me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Not authenticated', 401));
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(ERROR_CODES.NOT_FOUND, 'User not found', 404));
  }

  const memberships = await WorkspaceMember.find({ userId: user._id, status: 'active' }).populate('workspaceId');

  const workspaces = memberships
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
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      workspaces,
    },
    meta: { requestId: (req as any).requestId },
  });
}
