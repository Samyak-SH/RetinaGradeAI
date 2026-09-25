import { Router } from 'express';
import {
  listPatients,
  createPatient,
  getPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patientController.js';
import { createScan, listScans } from '../controllers/scanController.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadScan } from '../middleware/upload.js';
import { wrap } from '../utils/asyncHandler.js';

const router = Router();
router.use(wrap(requireAuth));

router.route('/').get(wrap(listPatients)).post(wrap(createPatient));
router
  .route('/:id')
  .get(wrap(getPatient))
  .put(wrap(updatePatient))
  .delete(wrap(deletePatient));
router
  .route('/:patientId/scans')
  .get(wrap(listScans))
  .post(uploadScan.single('image'), wrap(createScan));

export default router;
