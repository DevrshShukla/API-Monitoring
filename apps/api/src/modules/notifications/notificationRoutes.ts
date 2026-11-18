import { Router } from 'express';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from './notificationController.js';
import { authenticate, requireWorkspace } from '../../middleware/auth.js';

const router = Router();

router.use(authenticate, requireWorkspace);

router.get('/', listNotifications);
router.post('/read-all', markAllAsRead);
router.post('/:id/read', markAsRead);

export const notificationRoutes = router;
