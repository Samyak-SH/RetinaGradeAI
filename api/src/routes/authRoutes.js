import { Router } from 'express';
import { signup, login, me } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../utils/asyncHandler.js';

const router = Router();
router.post('/signup', wrap(signup));
router.post('/login', wrap(login));
router.get('/me', wrap(requireAuth), wrap(me));

export default router;
