import { Router } from 'express';
import { listAuditEvents } from './auditController.js';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { WORKSPACE_ROLE } from '@api-monitoring/shared';

const router = Router();

router.use(
  authenticate,
  requireWorkspace,
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN])
);

router.get('/', listAuditEvents);

export const auditRoutes = router;
