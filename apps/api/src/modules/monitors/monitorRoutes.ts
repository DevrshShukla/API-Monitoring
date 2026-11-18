import { Router } from 'express';
import {
  listMonitors,
  createMonitor,
  getMonitor,
  updateMonitor,
  pauseMonitor,
  resumeMonitor,
  deleteMonitor,
  getMonitorChecks,
} from './monitorController.js';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import {
  CreateMonitorSchema,
  UpdateMonitorSchema,
  MonitorQuerySchema,
  WORKSPACE_ROLE,
} from '@api-monitoring/shared';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/', validateQuery(MonitorQuerySchema), listMonitors);
router.post(
  '/',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(CreateMonitorSchema),
  createMonitor
);
router.get('/:id', getMonitor);
router.patch(
  '/:id',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(UpdateMonitorSchema),
  updateMonitor
);
router.post(
  '/:id/pause',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  pauseMonitor
);
router.post(
  '/:id/resume',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  resumeMonitor
);
router.delete(
  '/:id',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN]),
  deleteMonitor
);
router.get('/:id/checks', getMonitorChecks);

export const monitorRoutes = router;
