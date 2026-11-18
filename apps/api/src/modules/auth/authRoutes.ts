import { Router } from 'express';
import { register, login, refresh, logout, me } from './authController.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '@api-monitoring/shared';

const router = Router();

router.post('/register', validateBody(RegisterSchema), register);
router.post('/login', validateBody(LoginSchema), login);
router.post('/refresh', validateBody(RefreshTokenSchema), refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

export const authRoutes = router;
