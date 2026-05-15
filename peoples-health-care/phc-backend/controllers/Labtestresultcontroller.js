import mongoose from 'mongoose';
import LabTestResult, { PRE_CONDITIONS, RESULT_FIELDS, FASTING_HOURS, LAB_TEST_PRICES } from '../models/LabTestResult.js';
import { createNotification } from './NotificationController.js';
import LabRequest from '../models/LabRequest.js';

const TEST_NAME_MAP = {
  'cbc (full blood count)':     'FBC',  'cbc': 'FBC', 'full blood count': 'FBC', 'fbc': 'FBC',
  'esr': 'ESR',
  'fbs': 'FBS', 'fasting blood sugar': 'FBS', 'fasting blood glucose': 'FBS',
  'liver profile': 'Liver Profile', 'liver function test (lft)': 'Liver Profile', 'liver function test': 'Liver Profile', 'lft': 'Liver Profile',
  'renal profile': 'Renal Profile', 'kidney function test (kft)': 'Renal Profile', 'kidney function test': 'Renal Profile', 'kft': 'Renal Profile',
  'thyroid profile': 'Thyroid Profile', 'thyroid function (tsh)': 'Thyroid Profile', 'tsh': 'Thyroid Profile',
  'serum vit d level': 'Serum Vit D Level', 'vitamin d': 'Serum Vit D Level', 'vit d': 'Serum Vit D Level',
  'dengue ag': 'Dengue Ag', 'dengue ns1 antigen': 'Dengue Ag', 'dengue': 'Dengue Ag',
};

function mapTestName(name) {
  if (!name) return name;
  return TEST_NAME_MAP[name.toLowerCase().trim()] || name;
}

// ─── GET pre-condition template ────────────────────────────────────────────
export const getPreConditions = async (req, res) => {
  try {
    const raw      = decodeURIComponent(req.params.testName);
    const mapped   = mapTestName(raw);
    const template = PRE_CONDITIONS[mapped] || {
      checkboxes:   ['Patient has been informed about the test procedure'],
      shortAnswers: [{ question: 'Any relevant medical history or medications?', placeholder: 'Describe if any' }],
    };
    const fastingHours = FASTING_HOURS[mapped] ?? 0;
    res.status(200).json({ success: true, testName: mapped || raw, template, fastingHours });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET result-fields template ────────────────────────────────────────────
export const getResultFields = async (req, res) => {
  try {
    const raw      = decodeURIComponent(req.params.testName);
    const mapped   = mapTestName(raw);
    const template = RESULT_FIELDS[mapped] || {
      checkboxes:  [{ label: 'Results within normal range', defaultChecked: false }],
      parameters:  [{ name: 'Result', unit: '', ref: 'See report', min: null, max: null }],
    };
    res.status(200).json({ success: true, testName: mapped || raw, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CREATE lab test result (called after payment confirmation) ────────────
export const createLabTestResult = async (req, res) => {
  try {
    const { labRequestRef, appointmentId, testName, paymentId } = req.body;
    console.log('\n[LAB RESULT CREATE] Body:', JSON.stringify(req.body));

    if (!labRequestRef) return res.status(400).json({ success: false, message: 'labRequestRef is required' });
    if (!appointmentId) return res.status(400).json({ success: false, message: 'appointmentId is required' });
    if (!testName)      return res.status(400).json({ success: false, message: 'testName is required' });
    if (!paymentId)     return res.status(400).json({ success: false, message: 'paymentId is required' });

    const labRequest = await LabRequest.findOne({ labRequestId: labRequestRef });
    if (!labRequest) return res.status(404).json({ success: false, message: `LabRequest "${labRequestRef}" not found` });

    console.log('[LAB RESULT CREATE] Found:', labRequest.labRequestId, 'doctorId:', labRequest.doctorId);

    const testId = await LabTestResult.generateTestId();
    const now    = new Date();

    const result = await LabTestResult.create({
      testId,
      labRequestRef,
      appointmentId:   String(appointmentId),
      testName,
      patientId:       labRequest.patientId   || null,
      patientName:     labRequest.patientName || '',
      doctorId:        labRequest.doctorId,
      paymentId,
      paymentConfirmed: true,
      status:          'pre_check',
      conditionsSentAt: now,   // ← record the moment pre-conditions are dispatched
    });

    console.log('[LAB RESULT CREATE] Success:', result.testId, '| conditionsSentAt:', now);
    res.status(201).json({ success: true, message: 'Lab test result created', result });

  } catch (error) {
    console.error('[LAB RESULT CREATE] ERROR:', error.message);
    if (error.errors) {
      const details = Object.entries(error.errors).map(([k, v]) => `${k}: ${v.message}`);
      return res.status(400).json({ success: false, message: 'Validation failed', details });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── SAVE pre-test conditions → sample_received ───────────────────────────
// FEATURE 1: Enforces fasting / waiting time.
// If the required hours have NOT yet elapsed since conditionsSentAt,
// the request is BLOCKED and a clear warning is returned.
export const savePreTestConditions = async (req, res) => {
  try {
    const result = await LabTestResult.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Lab test result not found' });
    if (!['pre_check', 'payment_pending'].includes(result.status))
      return res.status(400).json({ success: false, message: `Cannot save pre-conditions at status: ${result.status}` });

    // ── Fasting / waiting time check ──────────────────────────────────────
    const mapped       = mapTestName(result.testName);
    const fastingHours = FASTING_HOURS[mapped] ?? 0;

    if (fastingHours > 0 && result.conditionsSentAt) {
      const sentAt      = new Date(result.conditionsSentAt);
      const readyAt     = new Date(sentAt.getTime() + fastingHours * 3600 * 1000);
      const now         = new Date();

      if (now < readyAt) {
        const remainingMs      = readyAt - now;
        const remainingHrs     = Math.floor(remainingMs / 3600000);
        const remainingMins    = Math.floor((remainingMs % 3600000) / 60000);

        const sentTimeStr  = sentAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const readyTimeStr = readyAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return res.status(400).json({
          success:          false,
          fastingWarning:   true,   // frontend uses this flag to style the warning differently
          message:          `Fasting period not yet complete.`,
          detail:           `Pre-conditions were sent at ${sentTimeStr}. The patient must fast for ${fastingHours} hour(s). Sample can only be accepted after ${readyTimeStr}.`,
          remainingTime:    `${remainingHrs}h ${remainingMins}m remaining`,
          sentAt:           sentAt.toISOString(),
          readyAt:          readyAt.toISOString(),
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const { checkboxes, shortAnswers } = req.body;
    result.preTestConditions = {
      checkboxes:         checkboxes   || [],
      shortAnswers:       shortAnswers || [],
      verifiedByLabStaff: true,
      verifiedAt:         new Date(),
    };
    result.status           = 'sample_received';
    result.sampleReceivedAt = new Date();
    await result.save();
    res.status(200).json({ success: true, message: 'Pre-conditions saved. Status → sample_received', result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── START test → in_progress ─────────────────────────────────────────────
export const startTest = async (req, res) => {
  try {
    const result = await LabTestResult.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Lab test result not found' });
    if (result.status !== 'sample_received')
      return res.status(400).json({ success: false, message: `Cannot start at status: ${result.status}` });
    result.status        = 'in_progress';
    result.testStartedAt = new Date();
    await result.save();
    res.status(200).json({ success: true, message: 'Test started', result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPLOAD results → completed ───────────────────────────────────────────
// Also marks the parent LabRequest as completed when all its tests are done.
export const uploadResults = async (req, res) => {
  try {
    const result = await LabTestResult.findById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Lab test result not found' });
    if (result.status !== 'in_progress')
      return res.status(400).json({ success: false, message: `Cannot upload at status: ${result.status}` });

    const { checkboxFindings, parameters, labNotes, performedBy } = req.body;
    result.results = {
      checkboxFindings: checkboxFindings || [],
      parameters:       parameters       || [],
      labNotes:         labNotes         || '',
      performedBy:      performedBy      || '',
    };
    result.status      = 'completed';
    result.completedAt = new Date();
    await result.save();

    // ── Notify doctor and patient that results are ready ──────────
    const targets = [];
    if (result.doctorId) targets.push(result.doctorId._id || result.doctorId);
    if (result.patientId) targets.push(result.patientId);
    if (targets.length > 0) {
      await createNotification({
        type:         'results_uploaded',
        title:        '✅ Lab Results Ready',
        message:      `${result.testName} results for ${result.patientName} are now available.`,
        targetRoles:  [],
        targetUserIds: targets,
        data: { testId: result.testId, testName: result.testName, patientName: result.patientName },
      });
    }

    // Mark parent LabRequest as completed if all its tests are done
    const allResults = await LabTestResult.find({ labRequestRef: result.labRequestRef });
    const allDone    = allResults.every(r => r.status === 'completed');
    if (allDone) {
      await LabRequest.findOneAndUpdate(
        { labRequestId: result.labRequestRef },
        { status: 'completed', completedAt: new Date() }
      );
      console.log('[UPLOAD RESULTS] LabRequest', result.labRequestRef, '→ completed');
    }

    await result.populate('doctorId', 'name email');
    res.status(200).json({ success: true, message: 'Results uploaded successfully', result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET all results (role-filtered) ──────────────────────────────────────
export const getLabTestResults = async (req, res) => {
  try {
    const { status, testName, labRequestRef, limit = 100 } = req.query;
    const role   = req.user.role;
    const filter = {};
    if (role === 'patient') {
      filter.$or = [{ patientId: req.user._id.toString() }, { patientId: req.user.userId }];
    } else if (role === 'doctor') {
      filter.doctorId = req.user._id;
    }
    if (status) {
      const list = status.split(',').map(s => s.trim());
      filter.status = list.length === 1 ? list[0] : { $in: list };
    }
    if (testName) filter.testName = decodeURIComponent(testName);
    if (labRequestRef) filter.labRequestRef = labRequestRef;
    const results = await LabTestResult
      .find(filter)
      .populate('doctorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.status(200).json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET single result ─────────────────────────────────────────────────────
export const getLabTestResult = async (req, res) => {
  try {
    const role   = req.user.role;
    const result = await LabTestResult.findById(req.params.id).populate('doctorId', 'name email');
    if (!result) return res.status(404).json({ success: false, message: 'Not found' });
    if (role === 'patient') {
      const uid    = req.user._id.toString();
      const userId = req.user.userId;
      if (result.patientId !== uid && result.patientId !== userId)
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (role === 'doctor' && result.doctorId?._id?.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Access denied' });
    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET by appointmentId ──────────────────────────────────────────────────
export const getResultsByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const role   = req.user.role;
    const filter = { appointmentId };
    if (role === 'patient') {
      filter.$or = [{ patientId: req.user._id.toString() }, { patientId: req.user.userId }];
    }
    if (role === 'doctor') filter.doctorId = req.user._id;
    const results = await LabTestResult
      .find(filter)
      .populate('doctorId', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: results.length, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET patient's pre_check tests with fasting status ───────────────────
// FEATURE 2: Used by the patient portal to show "your waiting time is done"
// notifications. Returns all pre_check tests for the current patient along
// with whether the fasting period has elapsed.
export const getPatientPendingNotifications = async (req, res) => {
  try {
    const uid    = req.user._id.toString();
    const userId = req.user.userId;
    const filter = {
      status: 'pre_check',
      $or: [{ patientId: uid }, { patientId: userId }],
    };
    const results = await LabTestResult.find(filter).sort({ createdAt: -1 });

    const notifications = results.map(r => {
      const mapped       = mapTestName(r.testName);
      const fastingHours = FASTING_HOURS[mapped] ?? 0;
      const sentAt       = r.conditionsSentAt ? new Date(r.conditionsSentAt) : new Date(r.createdAt);
      const readyAt      = new Date(sentAt.getTime() + fastingHours * 3600 * 1000);
      const now          = new Date();
      const isReady      = fastingHours === 0 || now >= readyAt;
      const remainingMs  = isReady ? 0 : readyAt - now;
      const remainingHrs = Math.floor(remainingMs / 3600000);
      const remainingMins= Math.floor((remainingMs % 3600000) / 60000);

      return {
        _id:          r._id,
        testId:       r.testId,
        testName:     r.testName,
        fastingHours,
        sentAt:       sentAt.toISOString(),
        readyAt:      readyAt.toISOString(),
        isReady,
        remainingTime: isReady ? null : `${remainingHrs}h ${remainingMins}m`,
      };
    });

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CASHIER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET all lab test prices ───────────────────────────────────────────────
export const getLabPrices = async (req, res) => {
  const entries = Object.entries(LAB_TEST_PRICES).map(([name, price]) => ({ name, price }));
  res.json({ success: true, prices: LAB_TEST_PRICES, entries });
};

// ─── GET pending lab requests that need cashier payment ───────────────────
export const getPendingLabPayments = async (req, res) => {
  try {
    const LabRequest = (await import('../models/LabRequest.js')).default;

    const pending = await LabRequest.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(100);

    const enriched = await Promise.all(pending.map(async (req) => {
      const existing = await LabTestResult.find({ labRequestRef: req.labRequestId }, 'testName');
      const paidNames = new Set(existing.map(r => r.testName));

      const unpaid = (req.tests || []).filter(t => !paidNames.has(t.name));
      const testsWithPrices = unpaid.map(t => ({
        name:  t.name,
        price: LAB_TEST_PRICES[t.name] || 0,
      }));

      const total = testsWithPrices.reduce((s, t) => s + t.price, 0);

      return {
        _id:          req._id,
        labRequestId: req.labRequestId,
        patientId:    req.patientId,
        patientName:  req.patientName,
        channelingNo: req.channelingNo,
        doctorName:   req.doctorName,
        priority:     req.priority,
        clinicalNotes:req.clinicalNotes,
        createdAt:    req.createdAt,
        unpaidTests:  testsWithPrices,
        totalPrice:   total,
        fullyPaid:    unpaid.length === 0,
      };
    }));

    const result = enriched.filter(r => !r.fullyPaid);
    res.json({ success: true, count: result.length, requests: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CASHIER confirms physical payment → creates LabTestResults ───────────
export const cashierConfirmLabPayment = async (req, res) => {
  try {
    const { labRequestId, tests, paymentId, paymentMethod, amountCollected } = req.body;

    if (!labRequestId) return res.status(400).json({ success: false, message: 'labRequestId is required' });
    if (!tests?.length) return res.status(400).json({ success: false, message: 'tests array is required' });
    if (!paymentId)     return res.status(400).json({ success: false, message: 'paymentId is required' });

    const LabRequest = (await import('../models/LabRequest.js')).default;
    const labReq = await LabRequest.findOne({ labRequestId });
    if (!labReq) return res.status(404).json({ success: false, message: `Lab request "${labRequestId}" not found` });

    const now     = new Date();
    const created = [];

    for (const test of tests) {
      const exists = await LabTestResult.findOne({ labRequestRef: labRequestId, testName: test.name });
      if (exists) continue;

      const testId = await LabTestResult.generateTestId();
      const result = await LabTestResult.create({
        testId,
        labRequestRef:    labRequestId,
        appointmentId:    labReq.prescriptionRef || labReq._id.toString(),
        testName:         test.name,
        patientId:        labReq.patientId   || null,
        patientName:      labReq.patientName || '',
        doctorId:         labReq.doctorId,
        paymentId,
        paymentConfirmed: true,
        paymentMethod:    paymentMethod || 'Cash',
        amountPaid:       test.price    || 0,
        status:           'pre_check',
        conditionsSentAt: now,
      });
      created.push(result);
    }

    if (created.length > 0) {
      await LabRequest.findOneAndUpdate(
        { labRequestId },
        { status: 'in_progress' }
      );

      const testNames = created.map(r => r.testName).join(', ');
      await createNotification({
        type:        'payment_confirmed',
        title:       '💳 Payment Confirmed — Tests Ready',
        message:     `Payment confirmed for ${labReq.patientName}. ${created.length} test(s) ready: ${testNames}`,
        targetRoles: ['lab'],
        data: { labRequestId, patientName: labReq.patientName, paymentId, testCount: created.length },
      });
    }

    res.status(201).json({
      success:  true,
      message:  `Payment confirmed. ${created.length} test(s) sent to laboratory.`,
      paymentId,
      created,
    });
  } catch (err) {
    console.error('[CASHIER CONFIRM]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};