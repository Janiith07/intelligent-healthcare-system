import PharmacyPrescription from "../models/PharmacyPrescription.js";
import PharmacyBill from "../models/Pharmacybill.js";
import Prescription from "../models/Prescription.js";
import Drug from "../models/Drug.js";
import DrugStock from "../models/DrugStock.js";
import LabRequest from "../models/LabRequest.js";
import LabTestResult from "../models/LabTestResult.js";

// ═══════════════════════════════════════════════════════════════
//  PHARMACY PRESCRIPTION CONTROLLER
//
//  Flow:
//    1. Doctor creates Prescription  (pharmacyStatus = 'pending')
//    2. GET /api/pharmacy  auto-pulls pending prescriptions into queue
//    3. Pharmacist reviews → PUT /:id/review
//         · links Drug records + sets availability + qty
//         · status → in_review or partially_available
//    4. Pharmacist dispenses → POST /:id/dispense
//         · deducts stock via FEFO immediately
//         · calculates bill (qty × unitPrice per stock entry)
//         · creates PharmacyBill → cashier sees it instantly
//         · marks prescription dispensed
// ═══════════════════════════════════════════════════════════════

// ── 1. RECEIVE prescription into pharmacy ─────────────────────
// POST /api/pharmacy/:prescriptionId/receive
export const receivePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.prescriptionId);
    if (!prescription)
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });

    const existing = await PharmacyPrescription.findOne({
      prescriptionId: prescription._id,
    });
    if (existing)
      return res.status(200).json({
        success: true,
        message: "Already received",
        pharmacyPrescription: existing,
      });

    if (prescription.pharmacyStatus === "dispensed")
      return res
        .status(400)
        .json({ success: false, message: "Already dispensed" });
    if (prescription.pharmacyStatus === "cancelled")
      return res
        .status(400)
        .json({ success: false, message: "Prescription cancelled" });

    const lines = prescription.medications.map((med) => ({
      medicationName: med.name,
      dosage: med.dosage,
      duration: med.duration,
      drugId: null,
      qtyToDispense: 0,
      availability: "available",
      pharmacistNote: "",
      stockDeducted: false,
    }));

    const pharmacyPrescription = await PharmacyPrescription.create({
      prescriptionId: prescription._id,
      prescriptionRef: prescription.prescriptionId,
      patientName: prescription.patientName,
      patientId: prescription.patientId,
      doctorName: prescription.doctorName,
      lines,
      status: "pending",
    });

    res.status(201).json({ success: true, pharmacyPrescription });
  } catch (error) {
    console.error("receivePrescription error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── 2. REVIEW lines – link drugs, check stock ─────────────────
// PUT /api/pharmacy/:id/review
// Body: { lines: [{ _id, drugId, qtyToDispense, availability, pharmacistNote }], generalNote }
//
// NOTE: This step does NOT deduct stock yet. Stock is deducted only on dispense.
//       This allows the pharmacist to adjust before committing.
export const reviewPrescription = async (req, res) => {
  try {
    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    );
    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    if (pharmacyPrescription.status === "dispensed")
      return res
        .status(400)
        .json({ success: false, message: "Already dispensed — cannot edit" });
    if (pharmacyPrescription.status === "cancelled")
      return res
        .status(400)
        .json({ success: false, message: "Prescription cancelled" });

    const { lines, generalNote } = req.body; //frontend sends full lines array with updates to drugId, qtyToDispense, availability, pharmacistNote

    if (!Array.isArray(lines) || lines.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "lines array is required" });

    // Update each line
    for (const updatedLine of lines) {
      const lineId = updatedLine._id || updatedLine.lineId;
      const line = pharmacyPrescription.lines.id(lineId);
      if (!line) continue;

      if (updatedLine.drugId !== undefined)
        line.drugId = updatedLine.drugId || null;
      if (updatedLine.qtyToDispense !== undefined)
        line.qtyToDispense = Number(updatedLine.qtyToDispense) || 0;
      if (updatedLine.availability !== undefined)
        line.availability = updatedLine.availability;
      if (updatedLine.pharmacistNote !== undefined)
        line.pharmacistNote = updatedLine.pharmacistNote || "";

      // Validate unavailable lines have a note
      if (line.availability !== "available" && !line.pharmacistNote?.trim())
        return res.status(400).json({
          success: false,
          message: `Add a note for "${line.medicationName}" — marked as ${line.availability.replace(/_/g, " ")}`,
        });

      // Validate available lines
      if (line.availability === "available") {
        if (!line.drugId)
          return res.status(400).json({
            success: false,
            message: `Link an inventory drug for "${line.medicationName}"`,
          });
        if (line.qtyToDispense <= 0)
          return res.status(400).json({
            success: false,
            message: `Set qty > 0 for "${line.medicationName}"`,
          });

        // Live stock check (warn if insufficient — but don't block, pharmacist can mark out_of_stock)
        const totalStock = await DrugStock.getTotalStock(line.drugId);
        if (totalStock < line.qtyToDispense) {
          const drug = await Drug.findById(line.drugId).select("name");
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${drug?.name ?? line.medicationName}" — available: ${totalStock}, requested: ${line.qtyToDispense}. Mark as out_of_stock instead.`,
          });
        }
      }
    }

    if (generalNote !== undefined)
      pharmacyPrescription.generalNote = generalNote;
    pharmacyPrescription.pharmacistId = req.user._id;
    pharmacyPrescription.reviewedAt = new Date();
    // pre-save hook auto-sets partially_available if any line is unavailable
    await pharmacyPrescription.save();

    // Return populated so frontend sees drugId objects
    const populated = await PharmacyPrescription.findById(
      pharmacyPrescription._id,
    )
      .populate("pharmacistId", "name")
      .populate(
        "lines.drugId",
        "drugId name brand form strength unit unitPrice",
      );

    res.status(200).json({
      success: true,
      message: "Prescription reviewed successfully",
      pharmacyPrescription: populated,
    });
  } catch (error) {
    console.error("reviewPrescription error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── 3. DISPENSE – deduct stock via FEFO + create bill ─────────
// POST /api/pharmacy/:id/dispense
export const dispensePrescription = async (req, res) => {
  try {
    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    ).populate(
      "lines.drugId",
      "drugId name brand form strength unit unitPrice",
    );

    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    if (pharmacyPrescription.status === "dispensed")
      return res
        .status(400)
        .json({ success: false, message: "Already dispensed" });
    if (pharmacyPrescription.status === "cancelled")
      return res
        .status(400)
        .json({ success: false, message: "Prescription is cancelled" });

    // Check all available lines are linked + have qty
    const unready = pharmacyPrescription.lines.filter(
      (l) =>
        l.availability === "available" && (!l.drugId || l.qtyToDispense <= 0),
    );
    if (unready.length > 0)
      return res.status(400).json({
        success: false,
        message: `Complete review first — ${unready.length} line(s) still unlinked or have no qty`,
      });

    // ── FEFO stock deduction + bill line building ──────────────
    const billLines = []; // dispensed (available) lines
    const unavailableLines = []; // out_of_stock / not_in_formulary lines

    for (const line of pharmacyPrescription.lines) {
      // ── Unavailable lines: collect for bill display ──────────
      if (line.availability !== "available") {
        unavailableLines.push({
          medicationName: line.medicationName,
          dosage: line.dosage || "",
          duration: line.duration || "",
          availability: line.availability,
          pharmacistNote: line.pharmacistNote || "",
        });
        continue;
      }

      // ── Available lines: skip if incomplete or already deducted
      if (!line.drugId || line.qtyToDispense <= 0) continue;
      if (line.stockDeducted) continue; // idempotent

      // Deduct stock via FEFO — returns array of { stockId, deducted }
      const touched = await DrugStock.deductFEFO(
        line.drugId,
        line.qtyToDispense,
      );
      line.stockDeducted = true;

      // Weighted average unit price across touched batches
      const drugDoc = line.drugId; // populated
      const catalogPrice =
        typeof drugDoc === "object" ? drugDoc.unitPrice || 0 : 0;

      let totalCost = 0;
      let totalQty = 0;
      for (const t of touched) {
        const stockEntry = await DrugStock.findOne({
          stockId: t.stockId,
        }).select("unitPrice");
        const price = stockEntry?.unitPrice || catalogPrice;
        totalCost += price * t.deducted;
        totalQty += t.deducted;
      }
      const effectiveUnitPrice =
        totalQty > 0
          ? Math.round((totalCost / totalQty) * 100) / 100
          : catalogPrice;

      billLines.push({
        medicationName: line.medicationName,
        drugId: typeof drugDoc === "object" ? drugDoc._id : drugDoc,
        qtyDispensed: line.qtyToDispense,
        unitPrice: effectiveUnitPrice,
        lineTotal:
          Math.round(effectiveUnitPrice * line.qtyToDispense * 100) / 100,
        stockEntries: touched,
      });
    }

    // ── Mark prescription dispensed ───────────────────────────
    pharmacyPrescription.status = "dispensed";
    pharmacyPrescription.dispensedAt = new Date();
    pharmacyPrescription.pharmacistId = req.user._id;
    await pharmacyPrescription.save();

    // Sync parent Prescription
    await Prescription.findByIdAndUpdate(pharmacyPrescription.prescriptionId, {
      pharmacyStatus: "dispensed",
      dispensedAt: pharmacyPrescription.dispensedAt,
      dispensedBy: req.user._id,
    });

    // ── Always create PharmacyBill (even if all lines are unavailable)
    const originalRx = await Prescription.findById(
      pharmacyPrescription.prescriptionId,
    ).select("channelingNo labRequestRef");

    // ── Build lab charge lines from linked LabRequest ────────
    const labLines = [];
    let labTotal = 0;

    if (originalRx?.labRequestRef) {
      const labReq = await LabRequest.findOne({
        labRequestId: originalRx.labRequestRef,
      });
      if (labReq?.tests?.length) {
        // Standard pricing table — update these as needed
        const LAB_PRICES = {
          FBC: 850,
          ESR: 400,
          FBS: 350,
          "Liver Profile": 1800,
          "Renal Profile": 2200,
          "Thyroid Profile": 2500,
          "Serum Vit D Level": 2800,
          "Dengue Ag": 1500,
        };
        const DEFAULT_PRICE = 1000;

        for (const test of labReq.tests) {
          const price = LAB_PRICES[test.name] ?? DEFAULT_PRICE;
          labLines.push({
            testName: test.name,
            price,
          });
          labTotal += price;
        }
      }
    }

    const DOCTOR_CHARGE = 1000;
    const drugSubtotal = billLines.reduce((sum, l) => sum + l.lineTotal, 0);
    const subtotal = Math.round((drugSubtotal + labTotal + DOCTOR_CHARGE) * 100) / 100;
    const billNumber = await PharmacyBill.generateBillNumber();

    const bill = await PharmacyBill.create({
      billNumber,
      pharmacyPrescriptionId: pharmacyPrescription._id,
      prescriptionRef: pharmacyPrescription.prescriptionRef,
      patientName: pharmacyPrescription.patientName,
      patientId: pharmacyPrescription.patientId || "",
      doctorName: pharmacyPrescription.doctorName,
      channelingNo: originalRx?.channelingNo || "",

      // Dispensed medication items
      lines: billLines,

      // Unavailable items — listed on bill, no cost
      unavailableLines,
      hasUnavailable: unavailableLines.length > 0,

      // Lab test charges — field names match labLineSchema in Pharmacybill.js
      labLines,
      labTotal: Math.round(labTotal * 100) / 100,
      hasLabTests: labLines.length > 0,

      // Doctor consultation charge
      doctorCharge: DOCTOR_CHARGE,

      // Combined totals
      subtotal,
      discount: 0,
      totalAmount: subtotal,

      paymentStatus: subtotal > 0 ? "unpaid" : "no_charge",

      // Notes — general note OR auto-flag when drugs are missing
      hasNote:
        !!pharmacyPrescription.generalNote?.trim() ||
        unavailableLines.length > 0,
      noteContent: pharmacyPrescription.generalNote || "",

      createdBy: req.user._id,
    });

    // Return populated prescription + bill
    const populated = await PharmacyPrescription.findById(
      pharmacyPrescription._id,
    )
      .populate("pharmacistId", "name")
      .populate(
        "lines.drugId",
        "drugId name brand form strength unit unitPrice",
      );

    res.status(200).json({
      success: true,
      message: "Prescription dispensed and bill sent to cashier",
      pharmacyPrescription: populated,
      bill,
    });
  } catch (error) {
    console.error("dispensePrescription error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET ALL pharmacy prescriptions ────────────────────────────
// GET /api/pharmacy
export const getAllPharmacyPrescriptions = async (req, res) => {
  try {
    const { status, patientId, limit = 100 } = req.query;

    // Auto-pull any doctor prescriptions not yet in queue
    const pendingDoctorRx = await Prescription.find({
      pharmacyStatus: "pending",
    });
    for (const rx of pendingDoctorRx) {
      const exists = await PharmacyPrescription.findOne({
        prescriptionId: rx._id,
      });
      if (!exists) {
        const lines = (rx.medications || []).map((med) => ({
          medicationName: med.name,
          dosage: med.dosage || "",
          duration: med.duration || "",
          drugId: null,
          qtyToDispense: 0,
          availability: "available",
          pharmacistNote: "",
          stockDeducted: false,
        }));
        await PharmacyPrescription.create({
          prescriptionId: rx._id,
          prescriptionRef: rx.prescriptionId,
          patientName: rx.patientName,
          patientId: rx.patientId || "",
          doctorName: rx.doctorName,
          lines,
          status: "pending",
        });
      }
    }

    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (patientId) filter.patientId = patientId;

    const list = await PharmacyPrescription.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("pharmacistId", "name")
      .populate(
        "lines.drugId",
        "drugId name brand form strength unit unitPrice",
      );

    res.status(200).json({
      success: true,
      count: list.length,
      prescriptions: list,
      pharmacyPrescriptions: list,
    });
  } catch (error) {
    console.error("getAllPharmacyPrescriptions error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET single pharmacy prescription ─────────────────────────
// GET /api/pharmacy/:id
export const getPharmacyPrescription = async (req, res) => {
  try {
    // Guard: reject non-ObjectId strings before Mongoose throws CastError
    if (!/^[a-f\d]{24}$/i.test(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: `Invalid id: "${req.params.id}"` });

    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    )
      .populate("prescriptionId")
      .populate("pharmacistId", "name")
      .populate(
        "lines.drugId",
        "drugId name brand form strength unit unitPrice",
      );

    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    res.status(200).json({ success: true, pharmacyPrescription });
  } catch (error) {
    console.error("getPharmacyPrescription error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET by reference ─────────────────────────────────────────
// GET /api/pharmacy/ref/:ref
export const getPharmacyPrescriptionByRef = async (req, res) => {
  try {
    const pharmacyPrescription = await PharmacyPrescription.findOne({
      prescriptionRef: req.params.ref,
    })
      .populate("prescriptionId")
      .populate("pharmacistId", "name")
      .populate(
        "lines.drugId",
        "drugId name brand form strength unit unitPrice",
      );

    if (!pharmacyPrescription)
      return res.status(404).json({
        success: false,
        message: "No pharmacy record for this reference",
      });

    res.status(200).json({ success: true, pharmacyPrescription });
  } catch (error) {
    console.error("getPharmacyPrescriptionByRef error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── CANCEL pharmacy prescription ─────────────────────────────
// PATCH /api/pharmacy/:id/cancel
export const cancelPharmacyPrescription = async (req, res) => {
  try {
    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    );
    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    if (pharmacyPrescription.status === "dispensed")
      return res
        .status(400)
        .json({ success: false, message: "Cannot cancel — already dispensed" });

    pharmacyPrescription.status = "cancelled";
    await pharmacyPrescription.save();

    await Prescription.findByIdAndUpdate(pharmacyPrescription.prescriptionId, {
      pharmacyStatus: "cancelled",
    });

    res.status(200).json({
      success: true,
      message: "Prescription cancelled",
      pharmacyPrescription,
    });
  } catch (error) {
    console.error("cancelPharmacyPrescription error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── PHARMACY DASHBOARD ────────────────────────────────────────
// GET /api/pharmacy/dashboard
export const getPharmacyDashboard = async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const week = new Date(today);
    week.setDate(today.getDate() - 6); // last 7 days
    const month = new Date(today);
    month.setDate(today.getDate() - 29); // last 30 days

    const [pending, inReview, partiallyAvailable, dispensedToday, cancelled] =
      await Promise.all([
        PharmacyPrescription.countDocuments({ status: "pending" }),
        PharmacyPrescription.countDocuments({ status: "in_review" }),
        PharmacyPrescription.countDocuments({ status: "partially_available" }),
        PharmacyPrescription.countDocuments({
          status: "dispensed",
          dispensedAt: { $gte: today, $lte: todayEnd },
        }),
        PharmacyPrescription.countDocuments({ status: "cancelled" }),
      ]);

    // Active queue
    const pendingQueue = await PharmacyPrescription.find({
      status: { $in: ["pending", "in_review", "partially_available"] },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("lines.drugId", "name strength form unit unitPrice");

    // ── Analytics ────────────────────────────────────────────

    // 1. Last 7 days dispensed per day
    const weeklyDispensed = await PharmacyPrescription.aggregate([
      { $match: { status: "dispensed", dispensedAt: { $gte: week } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$dispensedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 2. Hourly dispensing today (0-23)
    const hourlyToday = await PharmacyPrescription.aggregate([
      {
        $match: {
          status: "dispensed",
          dispensedAt: { $gte: today, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: { $hour: "$dispensedAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 3. Top 5 most dispensed drugs this month
    const topDrugs = await PharmacyPrescription.aggregate([
      { $match: { status: "dispensed", dispensedAt: { $gte: month } } },
      { $unwind: "$lines" },
      {
        $match: {
          "lines.availability": "available",
          "lines.qtyToDispense": { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$lines.medicationName",
          totalQty: { $sum: "$lines.qtyToDispense" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    // 4. Fulfillment rate today (available lines / total lines)
    const todayDispensed = await PharmacyPrescription.find({
      status: "dispensed",
      dispensedAt: { $gte: today, $lte: todayEnd },
    }).select("lines");

    let totalLines = 0,
      fulfilledLines = 0;
    for (const rx of todayDispensed) {
      for (const l of rx.lines || []) {
        totalLines++;
        if (l.availability === "available") fulfilledLines++;
      }
    }
    const fulfillmentRate =
      totalLines > 0 ? Math.round((fulfilledLines / totalLines) * 100) : null;

    // 5. Average processing time today (createdAt -> dispensedAt) in minutes
    const processingTimes = await PharmacyPrescription.aggregate([
      {
        $match: {
          status: "dispensed",
          dispensedAt: { $gte: today, $lte: todayEnd },
        },
      },
      {
        $project: {
          diffMs: { $subtract: ["$dispensedAt", "$createdAt"] },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: "$diffMs" },
        },
      },
    ]);
    const avgProcessingMins = processingTimes[0]
      ? Math.round(processingTimes[0].avgMs / 60000)
      : null;

    // 6. Out-of-stock hit rate today (how often a drug was requested but unavailable)
    let outOfStockHits = 0;
    for (const rx of todayDispensed) {
      for (const l of rx.lines || []) {
        if (l.availability === "out_of_stock") outOfStockHits++;
      }
    }

    res.status(200).json({
      success: true,
      dashboard: {
        prescriptionQueue: {
          pending,
          inReview,
          partiallyAvailable,
          dispensedToday,
          cancelled,
          pendingQueue,
        },
        analytics: {
          weeklyDispensed, // [{ _id: '2025-01-01', count: 5 }, ...]
          hourlyToday, // [{ _id: 9, count: 3 }, ...]
          topDrugs, // [{ _id: 'Paracetamol', totalQty: 45, count: 12 }, ...]
          fulfillmentRate, // 0-100 or null
          avgProcessingMins, // number or null
          outOfStockHits, // number
          totalLinesDispensedToday: totalLines,
        },
      },
    });
  } catch (error) {
    console.error("getPharmacyDashboard error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── AUTO-CHECK prescription lines against inventory ──────────
// GET /api/pharmacy/:id/auto-check
//
// For each medication line in the prescription, this endpoint:
//   1. Searches the Drug catalog by name (case-insensitive, partial match)
//   2. Checks if the exact strength requested by the doctor exists
//   3. Checks live stock levels for matched drugs
//
// Returns per-line status:
//   "match"           – drug + strength found, stock available
//   "out_of_stock"    – drug + strength found, but stock = 0
//   "wrong_strength"  – drug name found but NOT with the requested strength
//   "not_in_formulary"– drug name not found in inventory at all
//
// The frontend uses this to pre-fill availability dropdowns automatically.
export const autoCheckPrescriptionLines = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: `Invalid id: "${req.params.id}"` });

    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    ).select("lines prescriptionRef patientName");

    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    const results = [];

    for (const line of pharmacyPrescription.lines) {
      const medName = line.medicationName?.trim() || "";

      // ── Step 1: Find all drugs whose name loosely matches the medication name
      // We split the med name into words and look for any drug containing those words
      const words = medName.split(/\s+/).filter((w) => w.length >= 2);
      const nameQuery =
        words.length > 0
          ? { $or: words.map((w) => ({ name: { $regex: w, $options: "i" } })) }
          : { name: { $regex: medName, $options: "i" } };

      const matchingDrugs = await Drug.find({ ...nameQuery, isActive: true })
        .select("_id drugId name brand form strength unit unitPrice")
        .limit(10);

      // ── Step 2: Also try an exact-name match (covers full brand names)
      const exactMatches = await Drug.find({
        name: {
          $regex: `^${medName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          $options: "i",
        },
      })
        .select("_id drugId name brand form strength unit unitPrice")
        .limit(5);

      // Merge unique results
      const allMatches = [...matchingDrugs];
      for (const d of exactMatches) {
        if (!allMatches.find((x) => String(x._id) === String(d._id)))
          allMatches.push(d);
      }

      if (allMatches.length === 0) {
        // No drug by this name at all in inventory
        results.push({
          lineId: String(line._id),
          medicationName: medName,
          status: "not_in_formulary",
          message: `"${medName}" is not in the drug inventory`,
          matchedDrug: null,
          totalStock: 0,
        });
        continue;
      }

      // ── Step 3: Check if any matched drug has the correct strength
      // Extract strength tokens from the prescription's dosage field
      // e.g. "500mg twice daily" → "500mg", or use medicationName if it contains strength
      const dosageText = (line.dosage || "").trim();
      const strengthHints = [dosageText, medName].join(" ");
      const strengthTokens =
        strengthHints.match(
          /\d+(\.\d+)?\s*(mg|ml|g|mcg|iu|mg\/5ml|mg\/ml)(\s*\/\s*\d+\s*(mg|ml))?/gi,
        ) || [];

      // Find drugs that match on strength
      let strengthMatch = null;
      if (strengthTokens.length > 0) {
        for (const token of strengthTokens) {
          const normalised = token.replace(/\s+/g, "").toLowerCase();
          strengthMatch = allMatches.find((d) => {
            const dStr = (d.strength || "").replace(/\s+/g, "").toLowerCase();
            return (
              dStr === normalised ||
              dStr.includes(normalised) ||
              normalised.includes(dStr)
            );
          });
          if (strengthMatch) break;
        }
      }

      // If no strength token extracted, use the best name match
      const bestDrug = strengthMatch || allMatches[0];
      const totalStock = await DrugStock.getTotalStock(bestDrug._id);

      if (!strengthMatch && strengthTokens.length > 0) {
        // Drug name exists but no variant has the requested strength
        const availableStrengths = allMatches
          .map((d) => d.strength)
          .filter(Boolean)
          .join(", ");
        results.push({
          lineId: String(line._id),
          medicationName: medName,
          status: "wrong_strength",
          message: `"${medName}" found but not in the requested strength. Available: ${availableStrengths || "unknown"}`,
          matchedDrug: bestDrug,
          totalStock: 0,
          availableStrengths: allMatches.map((d) => ({
            _id: d._id,
            name: d.name,
            strength: d.strength,
            totalStock: 0,
          })),
        });
        continue;
      }

      if (totalStock <= 0) {
        results.push({
          lineId: String(line._id),
          medicationName: medName,
          status: "out_of_stock",
          message: `"${bestDrug.name} ${bestDrug.strength}" is out of stock`,
          matchedDrug: bestDrug,
          totalStock: 0,
        });
        continue;
      }

      results.push({
        lineId: String(line._id),
        medicationName: medName,
        status: "match",
        message: `"${bestDrug.name} ${bestDrug.strength}" — ${totalStock} in stock`,
        matchedDrug: bestDrug,
        totalStock,
      });
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("autoCheckPrescriptionLines error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET lab test info linked to a pharmacy prescription ───────
// GET /api/pharmacy/:id/labtest
// Returns the LabRequest + its LabTestResults if the original
// prescription had a linked lab request (labRequestRef).
export const getLabTestForPharmacy = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: `Invalid id: "${req.params.id}"` });

    const pharmacyPrescription = await PharmacyPrescription.findById(
      req.params.id,
    ).select("prescriptionId prescriptionRef patientName");

    if (!pharmacyPrescription)
      return res
        .status(404)
        .json({ success: false, message: "Pharmacy prescription not found" });

    // Load the original doctor's prescription to get labRequestRef
    const originalRx = await Prescription.findById(
      pharmacyPrescription.prescriptionId,
    ).select("labRequestRef labRequestId");

    if (!originalRx || !originalRx.labRequestRef) {
      return res.status(200).json({
        success: true,
        hasLabTest: false,
        labRequest: null,
        labResults: [],
      });
    }

    // Fetch the lab request
    const labRequest = await LabRequest.findOne({
      labRequestId: originalRx.labRequestRef,
    });

    // Fetch any results for this lab request
    const labResults = labRequest
      ? await LabTestResult.find({ labRequestRef: labRequest.labRequestId })
          .select("testId testName status results completedAt sampleReceivedAt")
          .sort({ createdAt: 1 })
      : [];

    res.status(200).json({
      success: true,
      hasLabTest: true,
      labRequest,
      labResults,
    });
  } catch (error) {
    console.error("getLabTestForPharmacy error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET PHARMACY NOTIFICATIONS ────────────────────────────────
// GET /api/pharmacy/notifications
// Returns:
//   - Pending prescriptions (not yet dispensed)
//   - Low stock drugs (below threshold)
//   - Recently dispensed items
export const getPharmacyNotifications = async (req, res) => {
  try {
    const LOW_STOCK_THRESHOLD = 20; // Alert if stock < 20 units

    // 1. Get pending/in-review prescriptions
    const pendingPrescriptions = await PharmacyPrescription.find({
      status: { $in: ["pending", "in_review", "partially_available"] },
    })
      .select("prescriptionRef patientName status createdAt lines")
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("lines.drugId", "name strength form unit");

    // 2. Get low stock drugs
    const lowStockDrugs = await DrugStock.aggregate([
      {
        $match: {
          quantity: { $lt: LOW_STOCK_THRESHOLD },
        },
      },
      {
        $lookup: {
          from: "drugs",
          localField: "drugId",
          foreignField: "_id",
          as: "drug",
        },
      },
      {
        $unwind: "$drug",
      },
      {
        $project: {
          drugName: "$drug.name",
          strength: "$drug.strength",
          form: "$drug.form",
          unit: "$drug.unit",
          quantity: 1,
          batchNo: 1,
          expiryDate: 1,
          unitPrice: 1,
        },
      },
      {
        $sort: { quantity: 1 },
      },
      {
        $limit: 10,
      },
    ]);

    // 3. Format notifications
    const prescriptionNotifications = pendingPrescriptions.map((rx) => ({
      type: "prescription",
      id: rx._id,
      ref: rx.prescriptionRef,
      message: `${rx.patientName} - ${rx.prescriptionRef}`,
      details: `${rx.lines?.length || 0} medications`,
      status: rx.status,
      time: rx.createdAt,
      icon: "💊",
    }));

    const stockNotifications = lowStockDrugs.map((drug) => ({
      type: "low_stock",
      id: drug._id,
      drugName: drug.drugName,
      message: `${drug.drugName} ${drug.strength || ""}`.trim(),
      details: `${drug.quantity} ${drug.unit} remaining`,
      quantity: drug.quantity,
      expiryDate: drug.expiryDate,
      icon: "⚠️",
      time: new Date(),
    }));

    // Combine all notifications, sorted by time (newest first)
    const allNotifications = [
      ...prescriptionNotifications,
      ...stockNotifications,
    ].sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json({
      success: true,
      notifications: allNotifications,
      summary: {
        pendingPrescriptions: pendingPrescriptions.length,
        lowStockItems: lowStockDrugs.length,
        total: allNotifications.length,
      },
    });
  } catch (error) {
    console.error("getPharmacyNotifications error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};