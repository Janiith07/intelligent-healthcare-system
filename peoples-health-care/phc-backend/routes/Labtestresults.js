import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorize }    from '../middleware/roleCheck.js';
import {
  createLabTestResult,
  savePreTestConditions,
  startTest,
  uploadResults,
  getLabTestResults,
  getLabTestResult,
  getPreConditions,
  getResultFields,
  getPatientPendingNotifications,
  getLabPrices,
  getPendingLabPayments,
  cashierConfirmLabPayment,
} from '../controllers/Labtestresultcontroller.js';

const router = express.Router();
router.use(protect);

// ── Templates (lab + admin + doctor can read) ──────────────────────────────
router.get('/pre-conditions/:testName',  authorize('lab', 'admin'),           getPreConditions);
router.get('/result-fields/:testName',   authorize('lab', 'admin', 'doctor'), getResultFields);

// ── Patient notification endpoint ─────────────────────────────────────────
router.get('/patient-notifications',     authorize('patient'),                 getPatientPendingNotifications);

// ── Cashier endpoints ──────────────────────────────────────────────────────
router.get('/prices',                    authorize('cashier', 'admin', 'lab'), getLabPrices);
router.get('/pending-lab-payments',      authorize('cashier', 'admin'),        getPendingLabPayments);
router.post('/cashier-confirm',          authorize('cashier'),                 cashierConfirmLabPayment);

// ── Lab CRUD ───────────────────────────────────────────────────────────────
router.post('/',                         authorize('lab'),                     createLabTestResult);
router.put('/:id/pre-conditions',        authorize('lab'),                     savePreTestConditions);
router.put('/:id/start',                 authorize('lab'),                     startTest);
router.put('/:id/upload-results',        authorize('lab'),                     uploadResults);

// ── Read ───────────────────────────────────────────────────────────────────
router.get('/',    authorize('lab', 'admin', 'doctor', 'patient', 'cashier'), getLabTestResults);
router.get('/:id', authorize('lab', 'admin', 'doctor', 'patient'),            getLabTestResult);

export default router;