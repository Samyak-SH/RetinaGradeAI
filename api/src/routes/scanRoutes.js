import { Router } from 'express';
import { getScan, deleteScan } from '../controllers/scanController.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../utils/asyncHandler.js';

const router = Router();
router.use(wrap(requireAuth));
router.route('/:id').get(wrap(getScan)).delete(wrap(deleteScan));

export default router;
