import express from 'express';
import {
  submitTurnoverReport,
  getTurnoverReports,
  getTurnoverReport,
  previewTodayBilling,
} from '../controllers/turnoverReportController.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const turnoverRouter = express.Router();

turnoverRouter.use(protect);

// Preview today's billing data (cashier only)
turnoverRouter.get('/preview', authorize('cashier'), previewTodayBilling);

// Submit a new report (cashier only)
turnoverRouter.post('/', authorize('cashier'), submitTurnoverReport);

// List all reports (admin + cashier)
turnoverRouter.get('/', authorize('admin', 'cashier'), getTurnoverReports);

// Get single report (admin + cashier)
turnoverRouter.get('/:id', authorize('admin', 'cashier'), getTurnoverReport);

export default turnoverRouter;