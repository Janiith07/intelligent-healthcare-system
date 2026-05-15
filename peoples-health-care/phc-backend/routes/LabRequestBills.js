import express from 'express';
import {
  getAllLabBills,
  getLabBill,
  markLabBillPaid,
  sendLabBillToPatient,
  updateLabBillPrices,
  notifyLabForLabBill,
  getMyLabBills,
  getLabNotifiedLabBills,
} from '../controllers/LabBillController.js';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';

const router = express.Router();
router.use(protect);

// Patient: view their own sent lab bills
router.get('/my-bills',         authorize('patient'),          getMyLabBills);

// Lab staff: view lab-notified lab request bills
router.get('/lab-notified',     authorize('lab', 'admin'),     getLabNotifiedLabBills);

// Cashier / admin
router.get  ('/',               authorize('cashier', 'admin'), getAllLabBills);
router.get  ('/:id',            authorize('cashier', 'admin'), getLabBill);
router.patch('/:id/prices',     authorize('cashier', 'admin'), updateLabBillPrices);
router.patch('/:id/pay',        authorize('cashier', 'admin'), markLabBillPaid);
router.patch('/:id/send-to-patient', authorize('cashier', 'admin'), sendLabBillToPatient);
router.patch('/:id/notify-lab', authorize('cashier', 'admin'), notifyLabForLabBill);

export default router;
