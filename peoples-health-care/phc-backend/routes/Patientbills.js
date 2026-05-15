import express from 'express';
import { getMyBills } from '../controllers/Billcontroller.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();

// GET /api/patient-bills  — patient views their own paid bills
router.get('/', protect, authorize('patient'), getMyBills);

export default router;