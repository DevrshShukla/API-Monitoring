import { Router } from 'express';
import {
  listWorkspaces,
  createWorkspace,
  getWorkspace,
  listMembers,
  addMember,
} from './workspaceController.js';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { WORKSPACE_ROLE } from '@api-monitoring/shared';

const router = Router();

router.use(authenticate);

router.get('/', listWorkspaces);
router.post('/', createWorkspace);
router.get('/:id', getWorkspace);

router.get('/:id/members', requireWorkspace, listMembers);
router.post(
  '/:id/members',
  requireWorkspace,
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN]),
  addMember
);

export const workspaceRoutes = router;
