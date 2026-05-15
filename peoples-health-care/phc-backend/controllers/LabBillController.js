import LabBill       from '../models/LabBill.js';
import LabRequest    from '../models/LabRequest.js';
import LabTestResult from '../models/LabTestResult.js';

const DOCTOR_CHARGE = 1000;

// Default test prices — used when lab request has no price set
const DEFAULT_PRICES = {
  'FBC':               800,
  'FBS':               400,
  'ESR':               350,
  'Liver Profile':    1200,
  'Renal Profile':    1500,
  'Thyroid Profile':  1800,
  'Serum Vit D Level':2500,
  'Dengue Ag':         900,
};

// ── AUTO-CREATE lab bill (called internally when doctor creates a lab request) ──
export const autoCreateLabBill = async (labReq, createdById) => {
  // Prevent duplicate bills
  const existing = await LabBill.findOne({ labRequestId: labReq.labRequestId });
  if (existing) return existing;

  const labLines = labReq.tests.map(t => ({
    testName: t.name,
    price:    t.price > 0 ? t.price : (DEFAULT_PRICES[t.name] ?? 0),
    isOther:  t.isOther || false,
  }));

  const labTotal    = labLines.reduce((s, l) => s + l.price, 0);
  const totalAmount = labTotal + DOCTOR_CHARGE;
  const billNumber  = await LabBill.generateBillNumber();

  return LabBill.create({
    billNumber,
    labRequestId:      labReq.labRequestId,
    labRequestRef:     labReq._id,
    patientName:       labReq.patientName,
    patientId:         labReq.patientId || '',
    doctorName:        labReq.doctorName,
    appointmentNumber: labReq.appointmentNumber || '',
    labLines,
    doctorCharge:      DOCTOR_CHARGE,
    labTotal,
    totalAmount,
    paymentStatus:     'unpaid',
    createdBy:         createdById,
  });
};

// ── GET all lab bills (cashier/admin) ────────────────────────
export const getAllLabBills = async (req, res) => {
  try {
    const { status, search, limit = 500 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.paymentStatus = status;
    if (search) {
      filter.$or = [
        { patientName:  { $regex: search, $options: 'i' } },
        { billNumber:   { $regex: search, $options: 'i' } },
        { labRequestId: { $regex: search, $options: 'i' } },
      ];
    }

    // Today range (Sri Lanka UTC+5:30)
    const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowSL      = new Date(Date.now() + SL_OFFSET_MS);
    const midnight   = new Date(Date.UTC(nowSL.getUTCFullYear(), nowSL.getUTCMonth(), nowSL.getUTCDate()));
    const todayStart = new Date(midnight.getTime() - SL_OFFSET_MS);
    const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [totalCount, unpaidCount, paidCount, bills, todayAgg] = await Promise.all([
      LabBill.countDocuments({}),
      LabBill.countDocuments({ paymentStatus: 'unpaid' }),
      LabBill.countDocuments({ paymentStatus: 'paid' }),
      LabBill.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('createdBy',   'name')
        .populate('collectedBy', 'name')
        .populate('sentBy',      'name'),
      LabBill.aggregate([
        { $match: { paymentStatus: 'paid', paidAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const todayData = todayAgg[0] || { total: 0, count: 0 };
    const summary = {
      totalCount, unpaidCount, paidCount,
      todayCollected: todayData.total,
      todayPaidCount: todayData.count,
    };
    res.status(200).json({ success: true, bills, summary });
  } catch (error) {
    console.error('getAllLabBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET single lab bill ──────────────────────────────────────
export const getLabBill = async (req, res) => {
  try {
    const bill = await LabBill.findById(req.params.id)
      .populate('createdBy',   'name')
      .populate('collectedBy', 'name')
      .populate('sentBy',      'name');
    if (!bill) return res.status(404).json({ success: false, message: 'Lab bill not found' });
    res.status(200).json({ success: true, bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── MARK PAID ────────────────────────────────────────────────
export const markLabBillPaid = async (req, res) => {
  try {
    const bill = await LabBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Lab bill not found' });
    if (bill.paymentStatus === 'paid')
      return res.status(400).json({ success: false, message: 'Bill already paid' });

    bill.paymentStatus = 'paid';
    bill.paymentMethod = 'Cash';
    bill.paidAt        = new Date();
    bill.collectedBy   = req.user._id;
    await bill.save();

    res.status(200).json({ success: true, message: 'Payment recorded', bill });
  } catch (error) {
    console.error('markLabBillPaid error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── SEND TO PATIENT ──────────────────────────────────────────
export const sendLabBillToPatient = async (req, res) => {
  try {
    const bill = await LabBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Lab bill not found' });
    if (bill.paymentStatus !== 'paid')
      return res.status(400).json({ success: false, message: 'Only paid bills can be sent to patient' });

    bill.sentToPatient = true;
    bill.sentAt        = new Date();
    bill.sentBy        = req.user._id;
    await bill.save();

    res.status(200).json({ success: true, message: 'Bill sent to patient portal', bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── UPDATE test prices (before payment) ─────────────────────
export const updateLabBillPrices = async (req, res) => {
  try {
    const bill = await LabBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ success: false, message: 'Lab bill not found' });
    if (bill.paymentStatus === 'paid')
      return res.status(400).json({ success: false, message: 'Cannot edit a paid bill' });

    const { labLines, doctorCharge } = req.body;
    if (labLines)                    bill.labLines     = labLines;
    if (doctorCharge !== undefined)  bill.doctorCharge = doctorCharge;

    bill.labTotal    = bill.labLines.reduce((s, l) => s + l.price, 0);
    bill.totalAmount = bill.labTotal + bill.doctorCharge;
    await bill.save();

    res.status(200).json({ success: true, message: 'Bill prices updated', bill });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── NOTIFY LABORATORY of paid lab tests ─────────────────────
export const notifyLabForLabBill = async (req, res) => {
  try {
    const bill = await LabBill.findById(req.params.id);
    if (!bill)
      return res.status(404).json({ success: false, message: 'Lab bill not found' });

    if (bill.paymentStatus !== 'paid')
      return res.status(400).json({ success: false, message: 'Only paid bills can notify the lab' });

    if (!(bill.labLines || []).length)
      return res.status(400).json({ success: false, message: 'This bill has no lab tests' });

    bill.labNotified   = true;
    bill.labNotifiedAt = new Date();
    bill.labNotifiedBy = req.user._id;
    await bill.save();

    // ── Update the linked LabRequest status so lab UI reflects payment ──
    if (bill.labRequestRef) {
      const labReq = await LabRequest.findByIdAndUpdate(
        bill.labRequestRef,
        { status: 'in_progress' },
        { new: true }
      );

      // ── Auto-create LabTestResult records (one per test) so the lab
      //    staff can immediately proceed to Pre-Check → Sample → Upload ──
      if (labReq?.tests?.length) {
        for (const test of labReq.tests) {
          const alreadyExists = await LabTestResult.findOne({
            labRequestRef: labReq.labRequestId,
            testName:      test.name,
          });
          if (alreadyExists) continue;   // don't duplicate on double-click

          const testId = await LabTestResult.generateTestId();
          await LabTestResult.create({
            testId,
            labRequestRef:    labReq.labRequestId,
            appointmentId:    labReq.appointmentNumber || labReq.labRequestId,
            testName:         test.name,
            paymentId:        bill.billNumber,
            paymentConfirmed: true,
            patientId:        labReq.patientId   || '',
            patientName:      labReq.patientName || '',
            doctorId:         labReq.doctorId,
            status:           'pre_check',
            conditionsSentAt: new Date(),
          });
        }
      }
    }

    res.status(200).json({ success: true, message: 'Laboratory notified', bill: bill.toObject() });
  } catch (error) {
    console.error('notifyLabForLabBill error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET patient's own lab bills (paid + sentToPatient) ───────
export const getMyLabBills = async (req, res) => {
  try {
    const patientId   = req.user.userId;   // e.g. "PAT-2026-0019"
    const patientName = req.user.name;

    // Match by patientId string (set when doctor selects registered patient)
    // OR by patientName as fallback (when doctor typed name freely)
    const bills = await LabBill.find({
      $or: [
        { patientId, paymentStatus: 'paid', sentToPatient: true },
        { patientName: { $regex: new RegExp(`^${patientName}$`, 'i') }, paymentStatus: 'paid', sentToPatient: true },
      ],
    })
      .sort({ createdAt: -1 })
      .populate('collectedBy', 'name');

    res.status(200).json({ success: true, bills });
  } catch (error) {
    console.error('getMyLabBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET lab-notified lab request bills (lab staff) ───────────
export const getLabNotifiedLabBills = async (req, res) => {
  try {
    const bills = await LabBill.find({
      paymentStatus: 'paid',
      labNotified:   true,
    })
      .sort({ labNotifiedAt: -1 })
      .limit(300)
      .populate('labNotifiedBy', 'name');

    res.status(200).json({ success: true, bills });
  } catch (error) {
    console.error('getLabNotifiedLabBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
