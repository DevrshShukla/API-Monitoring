import { Router } from 'express';
import {
  listIncidents,
  getIncident,
  acknowledgeIncident,
  investigateIncident,
  resolveIncident,
  addIncidentNote,
} from './incidentController.js';
import { authenticate, requireWorkspace, requireRole } from '../../middleware/auth.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import {
  ResolveIncidentSchema,
  AddIncidentNoteSchema,
  IncidentQuerySchema,
  WORKSPACE_ROLE,
} from '@api-monitoring/shared';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/', validateQuery(IncidentQuerySchema), listIncidents);
router.get('/:id', getIncident);

router.post(
  '/:id/acknowledge',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  acknowledgeIncident
);

router.post(
  '/:id/investigate',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  investigateIncident
);

router.post(
  '/:id/resolve',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(ResolveIncidentSchema),
  resolveIncident
);

router.post(
  '/:id/notes',
  requireRole([WORKSPACE_ROLE.OWNER, WORKSPACE_ROLE.ADMIN, WORKSPACE_ROLE.MEMBER]),
  validateBody(AddIncidentNoteSchema),
  addIncidentNote
);

export const incidentRoutes = router;
