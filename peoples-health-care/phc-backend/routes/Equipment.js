import express from 'express';
import { protect }   from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';
import {
  getAllEquipment,
  getAlertCount,
  getPendingRequests,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  decrementStock,
  restockConsumable,
  sendStockRequest,
  sendServiceRequest,
  acknowledgeRequest,
  resolveRequest,
  checkAndAutoSendAlerts,
} from '../controllers/EquipmentController.js';

const router = express.Router();
router.use(protect);

// ── Read — lab + admin ─────────────────────────────────────────────────────
router.get('/',                 authorize('lab','admin'), getAllEquipment);
router.get('/alert-count',      authorize('lab','admin'), getAlertCount);
router.get('/pending-requests', authorize('lab','admin'), getPendingRequests);

// ── Create & Delete — ADMIN ONLY ──────────────────────────────────────────
router.post('/',        authorize('admin'), createEquipment);
router.delete('/:id',   authorize('admin'), deleteEquipment);

// ── Update — lab + admin ───────────────────────────────────────────────────
router.put('/:id', authorize('lab','admin'), updateEquipment);

// ── Lab actions ────────────────────────────────────────────────────────────
router.put('/:id/decrement',         authorize('lab'),           decrementStock);
router.put('/:id/restock',           authorize('lab','admin'),   restockConsumable);
router.post('/:id/stock-request',    authorize('lab'),           sendStockRequest);
router.post('/:id/service-request',  authorize('lab'),           sendServiceRequest);
router.post('/check-alerts',         authorize('lab','admin'),   checkAndAutoSendAlerts);

// ── Admin actions ──────────────────────────────────────────────────────────
router.post('/acknowledge', authorize('admin'), acknowledgeRequest);
router.post('/resolve',     authorize('admin'), resolveRequest);

export default router;