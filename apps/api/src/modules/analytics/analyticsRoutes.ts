import { Router } from 'express';
import {
  getOverview,
  getMonitorAnalytics,
  compareMonitors,
  getStatusDistribution,
} from './analyticsController.js';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/overview', getOverview);
router.get('/monitors/:id', getMonitorAnalytics);
router.get('/compare', compareMonitors);
router.get('/status-distribution', getStatusDistribution);

export const analyticsRoutes = router;
