import LabRequest from '../models/LabRequest.js';
import { autoCreateLabBill } from './LabBillController.js';

// ── Create standalone lab request (doctor opens lab page directly) ──
export const createLabRequest = async (req, res) => {
  try {
    const { patientName, patientId, appointmentNumber, tests, priority, clinicalNotes } = req.body;

    if (!patientName) return res.status(400).json({ success: false, message: 'Patient name is required' });
    if (!tests?.length) return res.status(400).json({ success: false, message: 'At least one test is required' });

    const labRequestId = await LabRequest.generateLabRequestId();
    const labRequest = await LabRequest.create({
      labRequestId,
      source: 'standalone',
      doctorId:          req.user._id,
      doctorName:        req.user.name,
      patientId:         patientId || null,
      patientName,
      appointmentNumber: appointmentNumber || null,
      tests,
      priority:          priority || 'Routine',
      clinicalNotes:     clinicalNotes || '',
      cashierNotified:   true,
      cashierNotifiedAt: new Date(),
    });

    res.status(201).json({ success: true, message: 'Lab request created', labRequest });

    // Auto-create lab bill for cashier
    try { await autoCreateLabBill(labRequest, req.user._id); } catch (e) { console.error('Auto lab bill error:', e.message); }
  } catch (error) {
    console.error('Create lab request error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Get all lab requests (role-filtered) ─────────────────────
export const getLabRequests = async (req, res) => {
  try {
    const { status, appointmentNumber, limit = 50 } = req.query;
    const filter = {};
    const role = req.user.role;

    if (role === 'doctor') filter.doctorId = req.user._id;
    if (role === 'lab')    filter.status = status || { $in: ['pending', 'in_progress', 'completed'] };
    if (role === 'patient') filter.patientId = req.user._id;
    if (role === 'admin' && status) filter.status = status;

    if (appointmentNumber) filter.appointmentNumber = appointmentNumber;

    const labRequests = await LabRequest.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.status(200).json({ success: true, count: labRequests.length, labRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Get single lab request ────────────────────────────────────
export const getLabRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const labRequest = id.startsWith('LR-')
      ? await LabRequest.findOne({ labRequestId: id })
      : await LabRequest.findById(id);
    if (!labRequest) return res.status(404).json({ success: false, message: 'Lab request not found' });
    res.status(200).json({ success: true, labRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Update pending lab request ───────────────────────────────
export const updateLabRequest = async (req, res) => {
  try {
    const labRequest = await LabRequest.findById(req.params.id);
    if (!labRequest) return res.status(404).json({ success: false, message: 'Lab request not found' });
    if (labRequest.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (labRequest.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Can only edit pending lab requests' });

    const { patientName, appointmentNumber, tests, priority, clinicalNotes } = req.body;
    if (patientName)                    labRequest.patientName        = patientName;
    if (appointmentNumber !== undefined) labRequest.appointmentNumber  = appointmentNumber || null;
    if (tests?.length)                  labRequest.tests              = tests;
    if (priority)                       labRequest.priority           = priority;
    if (clinicalNotes !== undefined)    labRequest.clinicalNotes      = clinicalNotes;

    await labRequest.save();
    res.status(200).json({ success: true, message: 'Lab request updated', labRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Lab staff: update status ──────────────────────────────────
export const updateLabStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in_progress', 'completed'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const labRequest = await LabRequest.findById(req.params.id);
    if (!labRequest) return res.status(404).json({ success: false, message: 'Lab request not found' });

    labRequest.status = status;
    if (status === 'completed') labRequest.completedAt = new Date();
    await labRequest.save();

    res.status(200).json({ success: true, message: 'Status updated', labRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── Cancel/delete pending lab request ────────────────────────
export const cancelLabRequest = async (req, res) => {
  try {
    const labRequest = await LabRequest.findById(req.params.id);
    if (!labRequest) return res.status(404).json({ success: false, message: 'Lab request not found' });
    if (labRequest.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (labRequest.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Can only cancel pending requests' });

    await LabRequest.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Lab request cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};