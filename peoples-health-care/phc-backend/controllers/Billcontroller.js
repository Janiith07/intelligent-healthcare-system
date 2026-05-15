import PharmacyBill from '../models/Pharmacybill.js';

const SL_OFFSET_MS  = 5.5 * 60 * 60 * 1000;
const DOCTOR_CHARGE = 1000;

function computeBillTotals(billObj) {
  const drugTotal   = (billObj.lines    || []).reduce((s, l) => s + l.lineTotal, 0);
  const labTotal    = (billObj.labLines || []).reduce((s, l) => s + l.price,     0);
  const totalAmount = drugTotal + labTotal + (billObj.doctorCharge ?? DOCTOR_CHARGE);
  return { totalAmount, labTotal };
}

function slTodayRange() {
  const nowSL      = new Date(Date.now() + SL_OFFSET_MS);
  const midnight   = new Date(Date.UTC(nowSL.getUTCFullYear(), nowSL.getUTCMonth(), nowSL.getUTCDate()));
  const todayStart = new Date(midnight.getTime() - SL_OFFSET_MS);
  const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { todayStart, todayEnd };
}

// ── GET ALL bills (cashier/admin) ────────────────────────────
export const getAllBills = async (req, res) => {
  try {
    const { status, search, limit = 200 } = req.query;
    const { todayStart, todayEnd } = slTodayRange();

    const filter = {};
    if (status && status !== 'all') {
      if (status === 'unpaid')    filter.paymentStatus = 'unpaid';
      else if (status === 'paid') filter.paymentStatus = 'paid';
      else                        filter.paymentStatus = status;
    }
    if (search) {
      filter.$or = [
        { patientName:     { $regex: search, $options: 'i' } },
        { billNumber:      { $regex: search, $options: 'i' } },
        { prescriptionRef: { $regex: search, $options: 'i' } },
      ];
    }

    const [totalCount, unpaidCount, paidCount, rawBills, todayPaidAgg] = await Promise.all([
      PharmacyBill.countDocuments({}),
      PharmacyBill.countDocuments({ paymentStatus: 'unpaid' }),
      PharmacyBill.countDocuments({ paymentStatus: 'paid' }),
      PharmacyBill.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('createdBy', 'name')
        .populate('collectedBy', 'name')
        .populate('sentBy', 'name'),
      PharmacyBill.aggregate([
        { $match: { paymentStatus: 'paid', paidAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const bills = rawBills.map(b => {
      const obj = b.toObject();
      if (obj.paymentStatus === 'paid' && obj.totalAmount > 0) {
        obj.doctorCharge = obj.doctorCharge ?? DOCTOR_CHARGE;
      } else {
        const { totalAmount } = computeBillTotals(obj);
        obj.totalAmount  = totalAmount;
        obj.doctorCharge = obj.doctorCharge ?? DOCTOR_CHARGE;
      }
      return obj;
    });

    const todayData = todayPaidAgg[0] || { total: 0, count: 0 };

    const summary = {
      unpaidCount,
      unpaidAmount:   bills.filter(b => b.paymentStatus === 'unpaid').reduce((s, b) => s + b.totalAmount, 0),
      paidCount,
      paidAmount:     bills.filter(b => b.paymentStatus === 'paid').reduce((s, b) => s + b.totalAmount, 0),
      totalCount,
      todayCollected: todayData.total,
      todayPaidCount: todayData.count,
    };

    res.status(200).json({ success: true, bills, summary });
  } catch (error) {
    console.error('getAllBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET single bill ─────────────────────────────────────────
export const getBill = async (req, res) => {
  try {
    const raw = await PharmacyBill.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('collectedBy', 'name')
      .populate('sentBy', 'name')
      .populate('lines.drugId', 'name brand form strength');

    if (!raw)
      return res.status(404).json({ success: false, message: 'Bill not found' });

    const bill = raw.toObject();
    const { totalAmount } = computeBillTotals(bill);
    bill.totalAmount  = bill.paymentStatus === 'paid' && bill.totalAmount > 0 ? bill.totalAmount : totalAmount;
    bill.doctorCharge = bill.doctorCharge ?? DOCTOR_CHARGE;

    res.status(200).json({ success: true, bill });
  } catch (error) {
    console.error('getBill error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET patient's own bills (only paid + sentToPatient) ──────
export const getMyBills = async (req, res) => {
  try {
    const patientId = req.user.userId;

    const rawBills = await PharmacyBill.find({
      patientId,
      paymentStatus: 'paid',
      sentToPatient: true,
    })
      .sort({ createdAt: -1 })
      .populate('collectedBy', 'name');

    const bills = rawBills.map(b => {
      const obj = b.toObject();
      if (obj.totalAmount > 0) {
        obj.doctorCharge = obj.doctorCharge ?? DOCTOR_CHARGE;
      } else {
        const { totalAmount } = computeBillTotals(obj);
        obj.totalAmount  = totalAmount;
        obj.doctorCharge = obj.doctorCharge ?? DOCTOR_CHARGE;
      }
      return obj;
    });

    res.status(200).json({ success: true, bills });
  } catch (error) {
    console.error('getMyBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── MARK PAID ────────────────────────────────────────────────
export const markBillPaid = async (req, res) => {
  try {
    const bill = await PharmacyBill.findById(req.params.id);
    if (!bill)
      return res.status(404).json({ success: false, message: 'Bill not found' });

    if (bill.paymentStatus === 'paid')
      return res.status(400).json({ success: false, message: 'Bill already paid' });

    const drugTotal   = bill.lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const labTotal    = (bill.labLines || []).reduce((sum, l) => sum + l.price, 0);
    const totalAmount = drugTotal + labTotal + (bill.doctorCharge ?? DOCTOR_CHARGE);

    bill.paymentStatus = 'paid';
    bill.paymentMethod = 'Cash';
    bill.paidAt        = new Date();
    bill.collectedBy   = req.user._id;
    bill.discount      = 0;
    bill.doctorCharge  = bill.doctorCharge ?? DOCTOR_CHARGE;
    bill.labTotal      = labTotal;
    bill.subtotal      = totalAmount;
    bill.totalAmount   = totalAmount;
    await bill.save();

    const result       = bill.toObject();
    result.totalAmount = totalAmount;

    res.status(200).json({ success: true, message: 'Payment recorded', bill: result });
  } catch (error) {
    console.error('markBillPaid error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET LAB-NOTIFIED bills (lab role only) ───────────────────
export const getLabNotifiedBills = async (req, res) => {
  try {
    const rawBills = await PharmacyBill.find({
      paymentStatus: 'paid',
      labNotified:   true,
    })
      .sort({ labNotifiedAt: -1 })
      .limit(300)
      .populate('labNotifiedBy', 'name');

    const bills = rawBills.map(b => {
      const obj = b.toObject();
      obj.doctorCharge = obj.doctorCharge ?? DOCTOR_CHARGE;
      return obj;
    });

    res.status(200).json({ success: true, bills });
  } catch (error) {
    console.error('getLabNotifiedBills error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── NOTIFY LABORATORY of paid lab tests ─────────────────────
export const notifyLab = async (req, res) => {
  try {
    const bill = await PharmacyBill.findById(req.params.id);
    if (!bill)
      return res.status(404).json({ success: false, message: 'Bill not found' });

    if (bill.paymentStatus !== 'paid')
      return res.status(400).json({ success: false, message: 'Only paid bills can notify the lab' });

    if (!bill.hasLabTests || !(bill.labLines || []).length)
      return res.status(400).json({ success: false, message: 'This bill has no lab tests' });

    bill.labNotified   = true;
    bill.labNotifiedAt = new Date();
    bill.labNotifiedBy = req.user._id;
    await bill.save();

    res.status(200).json({ success: true, message: 'Laboratory notified', bill: bill.toObject() });
  } catch (error) {
    console.error('notifyLab error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
export const sendBillToPatient = async (req, res) => {
  try {
    const bill = await PharmacyBill.findById(req.params.id);
    if (!bill)
      return res.status(404).json({ success: false, message: 'Bill not found' });

    if (bill.paymentStatus !== 'paid')
      return res.status(400).json({ success: false, message: 'Only paid bills can be sent to patient' });

    bill.sentToPatient = true;
    bill.sentAt        = new Date();
    bill.sentBy        = req.user._id;
    await bill.save();

    res.status(200).json({ success: true, message: 'Bill sent to patient portal', bill: bill.toObject() });
  } catch (error) {
    console.error('sendBillToPatient error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};