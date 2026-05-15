import express from 'express';
import { searchPatients, getAllPatients } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();

router.use(protect);
router.use(authorize('doctor', 'admin'));

// GET /api/patients/search?q=nimal
router.get('/search', searchPatients);

// GET /api/patients
router.get('/', getAllPatients);

export default router;