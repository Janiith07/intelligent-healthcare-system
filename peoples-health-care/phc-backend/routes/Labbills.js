import express from 'express';
import {
  getAllLabBills,
  getLabBill,
  markLabBillPaid,
  sendLabBillToPatient,
  updateLabBillPrices,
} from '../controllers/LabBillController.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();
router.use(protect);
router.use(authorize('cashier', 'admin'));

router.get  ('/',          getAllLabBills);
router.get  ('/:id',       getLabBill);
router.patch('/:id/prices',          updateLabBillPrices);
router.patch('/:id/pay',             markLabBillPaid);
router.patch('/:id/send-to-patient', sendLabBillToPatient);

export default router;
