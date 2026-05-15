import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleCheck.js';
import {
  getSessionInfo,
  bookAppointment,
  cancelAppointment,
  getMyAppointments,
  getAppointmentPDF,
  markHoliday,
  deleteHoliday,
  getHolidays,
  updateSessionConfig,
  getTodayAppointments,
  startAppointment,
  completeAppointment,
  getHolidayCancellations,
} from '../controllers/appointmentController.js';

const router = express.Router();


// ── Public-ish (require login but any role) ─────────────────────
router.get('/session-info', protect, getSessionInfo);
router.get('/holidays',     protect, getHolidays);


// ── Patient ────────────────────────────────────────────────────
router.post('/book',        protect, authorize('patient'), bookAppointment);
router.get('/my',           protect, authorize('patient'), getMyAppointments);
router.patch('/:id/cancel', protect, authorize('patient'), cancelAppointment);
router.get('/:id/pdf',      protect, getAppointmentPDF);


// ── Doctor ─────────────────────────────────────────────────────
router.get('/today',           protect, authorize('doctor'), getTodayAppointments);
router.patch('/:id/start',     protect, authorize('doctor'), startAppointment);
router.patch('/:id/complete',  protect, authorize('doctor'), completeAppointment);


// ── Admin / Doctor config ──────────────────────────────────────
// POST   /api/appointments/holidays          body: { date, reason, session?, type? }
// DELETE /api/appointments/holidays/:date    query: ?session=Morning|Evening|Both  (omit to delete all entries for that date)
// PATCH  /api/appointments/config
// Holiday-triggered cancellation feed for patient portal
router.get('/holiday-cancellations', protect, authorize('patient'), getHolidayCancellations);

router.post('/holidays',           protect, authorize('doctor'), markHoliday);
router.delete('/holidays/:date',   protect, authorize('doctor'), deleteHoliday);
router.patch('/config',            protect, authorize('doctor'), updateSessionConfig);


export default router;