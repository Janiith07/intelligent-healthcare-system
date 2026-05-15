import TurnoverReport from '../models/TurnoverReport.js';
import PharmacyBill   from '../models/Pharmacybill.js';
import LabBill        from '../models/LabBill.js';

// Sri Lanka Standard Time = UTC+5:30
const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function slTodayStr() {
  const nowSL = new Date(Date.now() + SL_OFFSET_MS);
  return nowSL.toISOString().slice(0, 10);
}

function slDayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const slMidnight = new Date(Date.UTC(y, m - 1, d));
  const dayStart   = new Date(slMidnight.getTime() - SL_OFFSET_MS);
  const dayEnd     = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { dayStart, dayEnd };
}

const DOCTOR_CHARGE = 1000;

function computeTotal(billObj) {
  const drugTotal = (billObj.lines    || []).reduce((s, l) => s + l.lineTotal, 0);
  const labTotal  = (billObj.labLines || []).reduce((s, l) => s + l.price,     0);
  return drugTotal + labTotal + (billObj.doctorCharge ?? DOCTOR_CHARGE);
}

function computeLabBillTotal(billObj) {
  const labTotal = (billObj.labLines || []).reduce((s, l) => s + l.price, 0);
  return labTotal + (billObj.doctorCharge ?? DOCTOR_CHARGE);
}

// ── POST /api/turnover-reports  (cashier only) ────────────────────
export const submitTurnoverReport = async (req, res) => {
  try {
    const { note = '', reportDate } = req.body;
    const dateStr = reportDate || slTodayStr();
    const { dayStart, dayEnd } = slDayRange(dateStr);

    // Pharmacy: paid today + all unpaid
    const rawPharmBills = await PharmacyBill.find({
      $or: [
        { paymentStatus: 'paid',   paidAt: { $gte: dayStart, $lte: dayEnd } },
        { paymentStatus: 'unpaid' },
      ]
    }).sort({ createdAt: 1 });

    // Lab: paid today + all unpaid
    const rawLabBills = await LabBill.find({
      $or: [
        { paymentStatus: 'paid',   paidAt: { $gte: dayStart, $lte: dayEnd } },
        { paymentStatus: 'unpaid' },
      ]
    }).sort({ createdAt: 1 });

    const pharmBills = rawPharmBills.map(b => {
      const obj = b.toObject();
      obj.totalAmount = obj.paymentStatus === 'paid' && obj.totalAmount > 0
        ? obj.totalAmount : computeTotal(obj);
      obj._source = 'pharmacy';
      return obj;
    });

    const labBills = rawLabBills.map(b => {
      const obj = b.toObject();
      obj.totalAmount = obj.paymentStatus === 'paid' && obj.totalAmount > 0
        ? obj.totalAmount : computeLabBillTotal(obj);
      obj._source = 'lab';
      return obj;
    });

    const bills = [...pharmBills, ...labBills];

    let totalCollected = 0, totalOutstanding = 0;
    let paidBills = 0, unpaidBills = 0;

    for (const b of bills) {
      if (b.paymentStatus === 'paid') {
        paidBills++;
        totalCollected += b.totalAmount;
      } else {
        unpaidBills++;
        totalOutstanding += b.totalAmount;
      }
    }

    const reportNumber = await TurnoverReport.generateReportNumber();

    const report = await TurnoverReport.create({
      reportNumber,
      reportDate:   dateStr,
      totalBills:   bills.length,
      paidBills,
      unpaidBills,
      totalCollected,
      totalOutstanding,
      billSnapshot: bills.map(b => ({
        billNumber:    b.billNumber,
        patientName:   b.patientName,
        doctorName:    b.doctorName,
        totalAmount:   b.totalAmount,
        paymentStatus: b.paymentStatus,
        paidAt:        b.paidAt || null,
      })),
      note,
      submittedBy:     req.user._id,
      submittedByName: req.user.name || '',
    });

    res.status(201).json({ success: true, report });
  } catch (error) {
    console.error('submitTurnoverReport error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/turnover-reports  (admin + cashier) ─────────────────
export const getTurnoverReports = async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const [reports, pharmPaidCount, pharmUnpaidCount, labPaidCount, labUnpaidCount,
           pharmAmounts, labAmounts] = await Promise.all([
      TurnoverReport.find({})
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('submittedBy', 'name'),

      PharmacyBill.countDocuments({ paymentStatus: 'paid' }),
      PharmacyBill.countDocuments({ paymentStatus: 'unpaid' }),
      LabBill.countDocuments({ paymentStatus: 'paid' }),
      LabBill.countDocuments({ paymentStatus: 'unpaid' }),

      // Pharmacy bill amounts
      PharmacyBill.aggregate([
        { $group: {
          _id: '$paymentStatus',
          total: { $sum: {
            $cond: [
              { $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $gt: ['$totalAmount', 0] }] },
              '$totalAmount',
              { $add: [
                { $reduce: { input: { $ifNull: ['$lines',    []] }, initialValue: 0, in: { $add: ['$$value', '$$this.lineTotal'] } } },
                { $reduce: { input: { $ifNull: ['$labLines', []] }, initialValue: 0, in: { $add: ['$$value', '$$this.price']     } } },
                { $ifNull: ['$doctorCharge', 1000] },
              ]}
            ]
          }}
        }}
      ]),

      // Lab bill amounts
      LabBill.aggregate([
        { $group: {
          _id: '$paymentStatus',
          total: { $sum: {
            $cond: [
              { $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $gt: ['$totalAmount', 0] }] },
              '$totalAmount',
              { $add: [
                { $reduce: { input: { $ifNull: ['$labLines', []] }, initialValue: 0, in: { $add: ['$$value', '$$this.price'] } } },
                { $ifNull: ['$doctorCharge', 1000] },
              ]}
            ]
          }}
        }}
      ]),
    ]);

    const pharmMap = {};
    for (const g of pharmAmounts) pharmMap[g._id] = g.total;
    const labMap = {};
    for (const g of labAmounts) labMap[g._id] = g.total;

    const totalBillCount   = pharmPaidCount + pharmUnpaidCount + labPaidCount + labUnpaidCount;
    const paidBillCount    = pharmPaidCount + labPaidCount;
    const unpaidBillCount  = pharmUnpaidCount + labUnpaidCount;
    const totalCollected   = (pharmMap['paid']   || 0) + (labMap['paid']   || 0);
    const totalOutstanding = (pharmMap['unpaid'] || 0) + (labMap['unpaid'] || 0);
    const unreadCount      = reports.filter(r => !r.readByAdmin).length;

    res.status(200).json({
      success: true,
      reports,
      stats: {
        totalBillCount,
        unpaidBillCount,
        paidBillCount,
        totalCollected,
        totalOutstanding,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('getTurnoverReports error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/turnover-reports/:id  (admin + cashier) ─────────────
export const getTurnoverReport = async (req, res) => {
  try {
    const report = await TurnoverReport.findById(req.params.id)
      .populate('submittedBy', 'name');
    if (!report)
      return res.status(404).json({ success: false, message: 'Report not found' });

    if (req.user.role === 'admin' && !report.readByAdmin) {
      report.readByAdmin = true;
      report.readAt      = new Date();
      await report.save();
    }

    // Live unpaid from BOTH sources
    const [pharmUnpaid, labUnpaid] = await Promise.all([
      PharmacyBill.find({ paymentStatus: 'unpaid' }),
      LabBill.find({ paymentStatus: 'unpaid' }),
    ]);

    const liveUnpaidTotal =
      pharmUnpaid.reduce((s, b) => s + computeTotal(b.toObject()), 0) +
      labUnpaid.reduce((s, b) => s + computeLabBillTotal(b.toObject()), 0);
    const liveUnpaidCount = pharmUnpaid.length + labUnpaid.length;

    // Update snapshot payment status from live pharmacy bills
    const reportObj  = report.toObject();
    const billNums   = reportObj.billSnapshot.map(b => b.billNumber);
    const [livePharm, liveLab] = await Promise.all([
      PharmacyBill.find({ billNumber: { $in: billNums } })
        .select('billNumber paymentStatus totalAmount lines labLines doctorCharge'),
      LabBill.find({ billNumber: { $in: billNums } })
        .select('billNumber paymentStatus totalAmount labLines doctorCharge'),
    ]);

    const liveBillMap = {};
    for (const b of livePharm) {
      const obj = b.toObject();
      liveBillMap[obj.billNumber] = {
        paymentStatus: obj.paymentStatus,
        totalAmount:   obj.paymentStatus === 'paid' && obj.totalAmount > 0
          ? obj.totalAmount : computeTotal(obj),
      };
    }
    for (const b of liveLab) {
      const obj = b.toObject();
      liveBillMap[obj.billNumber] = {
        paymentStatus: obj.paymentStatus,
        totalAmount:   obj.paymentStatus === 'paid' && obj.totalAmount > 0
          ? obj.totalAmount : computeLabBillTotal(obj),
      };
    }

    reportObj.billSnapshot = reportObj.billSnapshot.map(snap => ({
      ...snap,
      ...(liveBillMap[snap.billNumber] || {}),
    }));

    reportObj.totalOutstanding = liveUnpaidTotal;
    reportObj.unpaidBills      = liveUnpaidCount;

    res.status(200).json({ success: true, report: reportObj });
  } catch (error) {
    console.error('getTurnoverReport error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// ── GET /api/turnover-reports/preview  (cashier) ─────────────────
export const previewTodayBilling = async (req, res) => {
  try {
    const dateStr = req.query.date || slTodayStr();
    const { dayStart, dayEnd } = slDayRange(dateStr);

    // Pharmacy: paid today + all unpaid
    const [pharmPaidRaw, pharmUnpaidRaw, labPaidRaw, labUnpaidRaw] = await Promise.all([
      PharmacyBill.find({ paymentStatus: 'paid', paidAt: { $gte: dayStart, $lte: dayEnd } }).sort({ paidAt: 1 }),
      PharmacyBill.find({ paymentStatus: 'unpaid' }).sort({ createdAt: 1 }),
      LabBill.find({ paymentStatus: 'paid', paidAt: { $gte: dayStart, $lte: dayEnd } }).sort({ paidAt: 1 }),
      LabBill.find({ paymentStatus: 'unpaid' }).sort({ createdAt: 1 }),
    ]);

    const pharmPaid = pharmPaidRaw.map(b => {
      const obj = b.toObject();
      obj.totalAmount = obj.totalAmount > 0 ? obj.totalAmount : computeTotal(obj);
      return obj;
    });
    const pharmUnpaid = pharmUnpaidRaw.map(b => {
      const obj = b.toObject();
      obj.totalAmount = computeTotal(obj);
      return obj;
    });
    const labPaid = labPaidRaw.map(b => {
      const obj = b.toObject();
      obj.totalAmount = obj.totalAmount > 0 ? obj.totalAmount : computeLabBillTotal(obj);
      return obj;
    });
    const labUnpaid = labUnpaidRaw.map(b => {
      const obj = b.toObject();
      obj.totalAmount = computeLabBillTotal(obj);
      return obj;
    });

    const totalCollected   = [...pharmPaid, ...labPaid].reduce((s, b) => s + b.totalAmount, 0);
    const totalOutstanding = [...pharmUnpaid, ...labUnpaid].reduce((s, b) => s + b.totalAmount, 0);
    const paidBills        = pharmPaid.length   + labPaid.length;
    const unpaidBills      = pharmUnpaid.length + labUnpaid.length;

    const allBillsForReport = [...pharmPaid, ...labPaid, ...pharmUnpaid, ...labUnpaid];

    res.status(200).json({
      success: true,
      preview: {
        reportDate:       dateStr,
        totalBills:       paidBills + unpaidBills,
        paidBills,
        unpaidBills,
        totalCollected,
        totalOutstanding,
        bills: allBillsForReport.map(b => ({
          billNumber:    b.billNumber,
          patientName:   b.patientName,
          doctorName:    b.doctorName,
          totalAmount:   b.totalAmount,
          paymentStatus: b.paymentStatus,
          paidAt:        b.paidAt || null,
        })),
      }
    });
  } catch (error) {
    console.error('previewTodayBilling error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};
