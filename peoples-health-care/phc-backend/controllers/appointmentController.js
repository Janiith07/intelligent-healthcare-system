import Appointment from '../models/Appointment.js';
import Holiday     from '../models/Holiday.js';
import Config      from '../models/Config.js';
import PDFDocument from 'pdfkit';
import User        from '../models/User.js';

// ── Clinic contact details (fixed) ────────────────────────
const CLINIC = {
  name:    "People's Health Care",
  doctor:  'Dr. M.T.D Jayaweera',
  quals:   'MBBS (Sri Lanka)',
  slmc:    'SLMC Reg No- 14508',
  address: 'No. 123, Akuressa Road, Isadeen Town, Matara.',
  tel:     'Tele - 041 2221761',
};

// ── Get or create config ───────────────────────────────────
async function getConfig() {
  let config = await Config.findOne();
  if (!config) config = await Config.create({});
  return config;
}

// ── Calculate estimated time ───────────────────────────────
function calculateEstimatedTime(startTime, position) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + position * 3;
  const finalHours   = Math.floor(totalMinutes / 60) % 24;
  const finalMinutes = totalMinutes % 60;
  return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
}

// ── Check if date is Sunday ────────────────────────────────
function isSunday(date) {
  return new Date(date + 'T00:00:00').getDay() === 0;
}

// ── Check if session is blocked by holiday ─────────────────
async function getBlockingHoliday(date, session) {
  const fullDay = await Holiday.findOne({ date, session: 'Both' });
  if (fullDay) return fullDay;
  if (session) {
    const sessionSpecific = await Holiday.findOne({ date, session });
    if (sessionSpecific) return sessionSpecific;
  }
  return null;
}

// ── Check if a session is still bookable based on current time ──
// Morning session: 07:00 - 07:45  → bookable if current time < 07:45
// Evening session: 16:30 - 20:00  → bookable if current time < 20:00
function isSessionStillOpen(session, config) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (session === 'Morning') {
    // Parse end time e.g. "07:45"
    const [endH, endM] = (config.morningSessionEnd || '07:45').split(':').map(Number);
    const endMinutes   = endH * 60 + endM;
    return currentMinutes < endMinutes;
  } else {
    const [endH, endM] = (config.eveningSessionEnd || '20:00').split(':').map(Number);
    const endMinutes   = endH * 60 + endM;
    return currentMinutes < endMinutes;
  }
}

// ══════════════════════════════════════════════════════════
// GET SESSION INFO
// ══════════════════════════════════════════════════════════
export const getSessionInfo = async (req, res) => {
  try {
    const { date, session } = req.query;

    if (!date || !session)
      return res.status(400).json({ success: false, message: 'Date and session are required' });

    if (isSunday(date))
      return res.status(400).json({ success: false, message: 'Medical center is closed on Sundays' });

    const today = new Date().toISOString().split('T')[0];

    if (date < today)
      return res.status(400).json({ success: false, message: 'Cannot book appointments for past dates' });

    // If booking for today — check if session is still open
    const config = await getConfig();
    if (date === today && !isSessionStillOpen(session, config)) {
      const endTime = session === 'Morning'
        ? (config.morningSessionEnd || '07:45')
        : (config.eveningSessionEnd || '20:00');
      return res.status(400).json({
        success: false,
        message: `The ${session} session has already ended for today (ended at ${endTime})`,
      });
    }

    const holiday = await getBlockingHoliday(date, session);
    if (holiday) {
      const sessionLabel = holiday.session !== 'Both' ? ` (${holiday.session} session)` : '';
      return res.status(400).json({
        success: false,
        message: `This date${sessionLabel} is unavailable: ${holiday.reason || 'Doctor unavailable'}`,
      });
    }

    const startTime    = session === 'Morning' ? config.morningSessionStart : config.eveningSessionStart;
    const activeCount  = await Appointment.countDocuments({ date, session, status: 'Pending' });
    const estimatedTime = calculateEstimatedTime(startTime, activeCount);

    res.status(200).json({
      success: true,
      data: { date, session, startTime, activeCount, estimatedTime },
    });

  } catch (error) {
    console.error('getSessionInfo error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// BOOK APPOINTMENT
// ══════════════════════════════════════════════════════════
export const bookAppointment = async (req, res) => {
  try {
    const { date, session } = req.body;
    const patientId   = req.user.userId;
    const patientName = req.user.name;

    if (!date || !session)
      return res.status(400).json({ success: false, message: 'Date and session are required' });

    if (isSunday(date))
      return res.status(400).json({ success: false, message: 'Medical center is closed on Sundays' });

    const today = new Date().toISOString().split('T')[0];

    if (date < today)
      return res.status(400).json({ success: false, message: 'Cannot book appointments for past dates' });

    // Time-based check for today
    const config = await getConfig();
    if (date === today && !isSessionStillOpen(session, config)) {
      const endTime = session === 'Morning'
        ? (config.morningSessionEnd || '07:45')
        : (config.eveningSessionEnd || '20:00');
      return res.status(400).json({
        success: false,
        message: `The ${session} session has already ended for today (ended at ${endTime})`,
      });
    }

    const holiday = await getBlockingHoliday(date, session);
    if (holiday) {
      const sessionLabel = holiday.session !== 'Both' ? ` (${holiday.session} session)` : '';
      return res.status(400).json({
        success: false,
        message: `This date${sessionLabel} is unavailable: ${holiday.reason || 'Doctor unavailable'}`,
      });
    }

    const duplicate = await Appointment.findOne({ patientId, date, session, status: 'Pending' });
    if (duplicate)
      return res.status(400).json({ success: false, message: 'You already have an active booking for this date and session' });

    const startTime     = session === 'Morning' ? config.morningSessionStart : config.eveningSessionStart;
    const activeCount   = await Appointment.countDocuments({ date, session, status: 'Pending' });
    const estimatedTime = calculateEstimatedTime(startTime, activeCount);
    const appointmentId = await Appointment.generateAppointmentId();

    const appointment = await Appointment.create({
      appointmentId,
      patientId,
      patientName,
      date,
      session,
      estimatedTime,
      status: 'Pending',
    });
    // Note: channelingNo removed as per madam's instruction

    res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment });

  } catch (error) {
    console.error('bookAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// CANCEL APPOINTMENT
// When cancelled, the patient count decreases automatically
// because countDocuments only counts Pending appointments
// ══════════════════════════════════════════════════════════
export const cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.patientId !== req.user.userId)
      return res.status(403).json({ success: false, message: 'You can only cancel your own appointments' });

    if (appointment.status === 'Completed')
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed appointment' });

    if (appointment.status === 'Cancelled')
      return res.status(400).json({ success: false, message: 'Appointment is already cancelled' });

    if (appointment.status === 'In Progress')
      return res.status(400).json({ success: false, message: 'Cannot cancel an appointment that is in progress' });

    appointment.status = 'Cancelled';
    await appointment.save();

    res.status(200).json({ success: true, message: 'Appointment cancelled successfully', appointment });

  } catch (error) {
    console.error('cancelAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// GET MY APPOINTMENTS
// ══════════════════════════════════════════════════════════
export const getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patientId: req.user.userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: appointments.length, appointments });

  } catch (error) {
    console.error('getMyAppointments error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// GET APPOINTMENT PDF
// ══════════════════════════════════════════════════════════
export const getAppointmentPDF = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.patientId !== req.user.userId)
      return res.status(403).json({ success: false, message: 'Access denied' });

    const patient = await User.findOne({ userId: appointment.patientId });

    let age = 'N/A';
    if (patient?.patientDetails?.birthday) {
      const today = new Date();
      const birth = new Date(patient.patientDetails.birthday);
      let years = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
      age = `${years} years`;
    }

    const bloodGroup = patient?.patientDetails?.bloodGroup || 'N/A';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="appointment-${appointment.appointmentId}.pdf"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    // ── Header bar ─────────────────────────────────────────
    doc.rect(0, 0, 595, 100).fill('#0D2137');

    doc.fillColor('white')
       .fontSize(20).font('Helvetica-Bold')
       .text(CLINIC.name, 50, 15);

    doc.fontSize(10).font('Helvetica')
       .text(CLINIC.doctor, 50, 40)
       .text(CLINIC.quals,  50, 54)
       .text(CLINIC.slmc,   50, 68);

    doc.fontSize(9)
       .text(CLINIC.address, 300, 40)
       .text(CLINIC.tel,     300, 54);

    // ── Confirmed badge ────────────────────────────────────
    doc.fillColor('#1a1a1a');
    doc.roundedRect(50, 115, 495, 45, 8).fill('#E8F5E9');
    doc.fillColor('#2E7D32').fontSize(13).font('Helvetica-Bold')
       .text('✓  Appointment Booked Successfully', 50, 128, {
         width: 495, align: 'center',
       });

    // ── Appointment Details section ────────────────────────
    doc.fillColor('#1a1a1a')
       .fontSize(13).font('Helvetica-Bold')
       .text('Appointment Details', 50, 178);

    doc.moveTo(50, 195).lineTo(545, 195).strokeColor('#E0E0E0').stroke();

    const drawRow = (label, value, y) => {
      doc.fontSize(10).font('Helvetica').fillColor('#757575').text(label, 50, y);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a').text(String(value), 230, y);
    };

    let y = 208;
    const gap = 28;

    drawRow('Appointment ID', appointment.appointmentId, y); y += gap;
    drawRow('Date',           appointment.date,          y); y += gap;
    drawRow('Session',        appointment.session,       y); y += gap;
    drawRow('Estimated Time', appointment.estimatedTime, y); y += gap;
    drawRow('Status',         appointment.status,        y); y += gap;

    // ── Divider ────────────────────────────────────────────
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke();
    y += 20;

    // ── Patient Details section ────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
       .text('Patient Details', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E0E0E0').stroke();
    y += 15;

    drawRow('Patient ID',  appointment.patientId,   y); y += gap;
    drawRow('Full Name',   appointment.patientName, y); y += gap;
    drawRow('Age',         age,                     y); y += gap;
    drawRow('Blood Group', bloodGroup,              y); y += gap;

    // ── Important notice ───────────────────────────────────
    y += 20;
    doc.roundedRect(50, y, 495, 75, 8).fill('#FFF8E1');
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#F57F17')
       .text('Important', 65, y + 12);
    doc.fontSize(9).font('Helvetica').fillColor('#5D4037')
       .text(
         'Please arrive 10 minutes before your estimated time. ' +
         'Bring this confirmation and any previous medical records. ' +
         'Contact us if you need to cancel your appointment.',
         65, y + 28, { width: 465 }
       );

    // ── Footer ─────────────────────────────────────────────
    const generatedOn = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    doc.fontSize(8).font('Helvetica').fillColor('#9E9E9E')
       .text(
         `Generated on ${generatedOn} · ${CLINIC.name} · ${CLINIC.tel}`,
         50, 760, { align: 'center', width: 495 }
       );

    doc.end();

  } catch (error) {
    console.error('getAppointmentPDF error:', error);
    res.status(500).json({ success: false, message: 'Server error generating PDF', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// MARK HOLIDAY (doctor)
// ══════════════════════════════════════════════════════════
export const getHolidayCancellations = async (req, res) => {
  try {
    const pending = await Appointment.find({
      patientId: req.user.userId,
      status: 'Cancelled',
      'cancellation.source': 'holiday',
      $or: [
        { 'cancellation.notifiedAt': null },
        { 'cancellation.notifiedAt': { $exists: false } },
      ],
    }).sort({ 'cancellation.cancelledAt': -1 });

    // Mark them as notified so subsequent polls do not resend.
    if (pending.length) {
      const now = new Date();
      await Appointment.updateMany(
        { _id: { $in: pending.map(p => p._id) } },
        { $set: { 'cancellation.notifiedAt': now } },
      );
    }

    res.status(200).json({
      success: true,
      count: pending.length,
      cancellations: pending.map(a => ({
        _id:          a._id,
        appointmentId: a.appointmentId,
        date:         a.date,
        session:      a.session,
        reason:       a.cancellation?.reason || 'Doctor unavailable',
        cancelledAt:  a.cancellation?.cancelledAt,
      })),
    });
  } catch (error) {
    console.error('getHolidayCancellations error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

export const markHoliday = async (req, res) => {
  try {
    const { date, reason, session = 'Both', type = 'unavailable' } = req.body;

    if (!date)
      return res.status(400).json({ success: false, message: 'Date is required' });

    if (isSunday(date))
      return res.status(400).json({ success: false, message: 'Sunday is already closed — no need to mark it' });

    const existing = await Holiday.findOne({ date, session });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: session === 'Both'
          ? 'This date is already fully blocked'
          : `The ${session} session on this date is already blocked`,
      });
    }

    const holiday = await Holiday.create({
      date, reason: reason || '', session, type, markedBy: req.user._id,
    });

// ── Auto-cancel affected Pending appointments ───────────────
    // When session === 'Both' the doctor has blocked the whole day,
    // so we target BOTH Morning and Evening. Otherwise we target
    // only the specific session.
    const sessionFilter = session === 'Both'
      ? { $in: ['Morning', 'Evening'] }
      : session;

    const affected = await Appointment.find({
      date,
      session: sessionFilter,
      status: 'Pending',
    });

    let cancelledCount = 0;
    if (affected.length) {
      const now = new Date();
      const reasonText = (reason && reason.trim()) || 'Doctor unavailable';

      await Appointment.updateMany(
        { _id: { $in: affected.map(a => a._id) } },
        {
          $set: {
            status: 'Cancelled',
            cancellation: {
              source:      'holiday',
              reason:      reasonText,
              cancelledAt: now,
              notifiedAt:  null, // patient has not seen the toast yet
            },
          },
        },
      );
      cancelledCount = affected.length;
    }

    res.status(201).json({ success: true, message: 'Unavailability marked successfully', holiday });

  } catch (error) {
    console.error('markHoliday error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// GET HOLIDAYS
// ══════════════════════════════════════════════════════════
export const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find()
      .select('date reason session type -_id')
      .sort({ date: 1 });
    res.status(200).json({ success: true, holidays });
  } catch (error) {
    console.error('getHolidays error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// DELETE HOLIDAY (doctor)
// ══════════════════════════════════════════════════════════
export const deleteHoliday = async (req, res) => {
  try {
    const { date } = req.params;
    const { session } = req.query;

    if (session) {
      const deleted = await Holiday.findOneAndDelete({ date, session });
      if (!deleted)
        return res.status(404).json({ success: false, message: 'No matching holiday found' });
      return res.status(200).json({ success: true, message: 'Holiday removed', date, session });
    }

    const result = await Holiday.deleteMany({ date });
    if (result.deletedCount === 0)
      return res.status(404).json({ success: false, message: 'No holiday found for that date' });

    res.status(200).json({ success: true, message: 'Holiday(s) removed', date });

  } catch (error) {
    console.error('deleteHoliday error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// UPDATE SESSION CONFIG (doctor)
// ══════════════════════════════════════════════════════════
export const updateSessionConfig = async (req, res) => {
  try {
    const {
      morningSessionStart, morningSessionEnd,
      eveningSessionStart, eveningSessionEnd,
      minutesPerPatient,
    } = req.body;

    const config = await getConfig();
    if (morningSessionStart) config.morningSessionStart = morningSessionStart;
    if (morningSessionEnd)   config.morningSessionEnd   = morningSessionEnd;
    if (eveningSessionStart) config.eveningSessionStart = eveningSessionStart;
    if (eveningSessionEnd)   config.eveningSessionEnd   = eveningSessionEnd;
    if (minutesPerPatient)   config.minutesPerPatient   = minutesPerPatient;
    await config.save();

    res.status(200).json({ success: true, message: 'Session configuration updated', config });

  } catch (error) {
    console.error('updateSessionConfig error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// GET TODAY'S APPOINTMENTS (doctor)
// ══════════════════════════════════════════════════════════
export const getTodayAppointments = async (req, res) => {
  try {
    // Accept optional ?date=YYYY-MM-DD — falls back to today
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const appointments = await Appointment.find({ date })
      .sort({ session: 1, createdAt: 1 });
    res.status(200).json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    console.error('getTodayAppointments error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// START APPOINTMENT (doctor)
// ══════════════════════════════════════════════════════════
export const startAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.status !== 'Pending')
      return res.status(400).json({
        success: false,
        message: `Cannot start an appointment that is already '${appointment.status}'`,
      });
    appointment.status = 'In Progress';
    await appointment.save();
    res.status(200).json({ success: true, message: 'Appointment started', appointment });
  } catch (error) {
    console.error('startAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════
// COMPLETE APPOINTMENT (doctor)
// ══════════════════════════════════════════════════════════
export const completeAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.status !== 'In Progress')
      return res.status(400).json({
        success: false,
        message: `Cannot complete an appointment that is '${appointment.status}' — it must be 'In Progress' first`,
      });
    appointment.status = 'Completed';
    await appointment.save();
    res.status(200).json({ success: true, message: 'Appointment completed', appointment });
  } catch (error) {
    console.error('completeAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};