import express from 'express';
import {
  createLabRequest, getLabRequests, getLabRequest,
  updateLabRequest, updateLabStatus, cancelLabRequest,
} from '../controllers/labRequestController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();
router.use(protect);

router.get('/',    getLabRequests);
router.get('/:id', getLabRequest);

router.post('/',              authorize('doctor'), createLabRequest);
router.put('/:id',            authorize('doctor'), updateLabRequest);
router.put('/:id/cancel',     authorize('doctor'), cancelLabRequest);
router.put('/:id/lab-status', authorize('lab'),    updateLabStatus);

export default router;