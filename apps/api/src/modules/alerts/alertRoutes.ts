import { Router } from 'express';
import {
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from './alertController.js';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import {
  CreateAlertRuleSchema,
  UpdateAlertRuleSchema,
  WORKSPACE_ROLE,
} from '@api-monitoring/shared';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/', listAlertRules);
router.post(
  '/',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(CreateAlertRuleSchema),
  createAlertRule
);
router.patch(
  '/:id',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(UpdateAlertRuleSchema),
  updateAlertRule
);
router.delete(
  '/:id',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN]),
  deleteAlertRule
);

export const alertRoutes = router;
