import express from 'express';
import {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getRatingDistribution,
  getFeedbackById,
  deleteFeedback,
  getMixedTestimonials,
} from '../controllers/feedbackcontroller.js';

import { protect }    from '../middleware/auth.js';
import { authorize }  from '../middleware/roleCheck.js';

const router = express.Router();

// ─── Public route (no auth) — top rated feedback for index page ───────────────
router.get('/public/top', getAllFeedback);
router.get('/public/mixed', getMixedTestimonials);

// ─── Patient routes ────────────────────────────────────────────────────────────
//must be logged in + patient role → runs submitFeedback.
router.post('/',   protect, authorize('patient'), submitFeedback);
router.get('/my',  protect, authorize('patient'), getMyFeedback);

// ─── Cashier routes ────────────────────────────────────────────────────────────
router.get('/distribution', protect, authorize('admin', 'cashier', 'patient'), getRatingDistribution);
router.get('/',             protect, authorize('admin', 'cashier'), getAllFeedback);
router.get('/:id',          protect, authorize('admin', 'cashier'), getFeedbackById);
router.delete('/:id',       protect, authorize('cashier', 'patient'), deleteFeedback);

export default router;