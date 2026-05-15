import Drug from "../models/Drug.js";
import DrugStock from "../models/DrugStock.js";

// ═══════════════════════════════════════════════════════════════
//  STOCK CONTROLLER  –  Pharmacist manages stock entries per drug
// ═══════════════════════════════════════════════════════════════

// ── ADD a stock entry (receive new stock for a drug) ───────────
// POST /api/stocks
// Body: { drugId, receivedQty, expiryDate, unitPrice?, manufacturedDate? }
export const addStock = async (req, res) => {
  try {
    const { drugId, receivedQty, expiryDate, unitPrice, manufacturedDate } =
      req.body;

    if (!drugId)
      return res
        .status(400)
        .json({ success: false, message: "drugId is required" });
    if (!receivedQty)
      return res
        .status(400)
        .json({ success: false, message: "receivedQty is required" });
    if (!expiryDate)
      return res
        .status(400)
        .json({ success: false, message: "expiryDate is required" });

    if (isNaN(receivedQty) || receivedQty <= 0)
      return res
        .status(400)
        .json({
          success: false,
          message: "receivedQty must be a positive number",
        });

    if (isNaN(Date.parse(expiryDate)))
      return res
        .status(400)
        .json({ success: false, message: "expiryDate must be a valid date" });

    if (new Date(expiryDate) <= new Date())
      return res
        .status(400)
        .json({ success: false, message: "expiryDate must be in the future" });

    const drug = await Drug.findById(drugId);
    if (!drug)
      return res
        .status(404)
        .json({ success: false, message: "Drug not found" });

    const stockId = await DrugStock.generateStockId();

    const stock = await DrugStock.create({
      stockId,
      drug: drugId,
      receivedQty: Number(receivedQty),
      remainingQty: Number(receivedQty),
      unitPrice: unitPrice ?? drug.unitPrice,
      expiryDate: new Date(expiryDate),
      manufacturedDate: manufacturedDate ? new Date(manufacturedDate) : null,
      addedBy: req.user._id,
    });

    const populated = await DrugStock.findById(stock._id)
      .populate("drug", "drugId name brand form strength unit")
      .populate("addedBy", "name");

    res.status(201).json({
      success: true,
      message: `Stock entry ${stockId} added for ${drug.name}`,
      stock: populated,
    });
  } catch (error) {
    console.error("addStock error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET ALL stock entries (optional: filter by drugId / status) ─
// GET /api/stocks
// Query: drugId, status, expiringSoon (days), limit
export const getAllStocks = async (req, res) => {
  try {
    const { drugId, status, expiringSoon, limit = 200 } = req.query;
    const filter = {};

    if (drugId) filter.drug = drugId;
    if (status) filter.status = status;

    if (expiringSoon) {
      const days = parseInt(expiringSoon) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      filter.expiryDate = { $lte: cutoff, $gt: new Date() };
      filter.status = "active";
    }

    const stocks = await DrugStock.find(filter)
      .sort({ expiryDate: 1 })
      .limit(parseInt(limit))
      .populate("drug", "drugId name brand form strength unit reorderLevel")
      .populate("addedBy", "name")
      .populate("lastUpdatedBy", "name");

    res.status(200).json({ success: true, count: stocks.length, stocks });
  } catch (error) {
    console.error("getAllStocks error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET stock entries for a specific drug ───────────────────────
// GET /api/stocks/drug/:drugId
export const getStocksByDrug = async (req, res) => {
  try {
    const drug = await Drug.findById(req.params.drugId);
    if (!drug)
      return res
        .status(404)
        .json({ success: false, message: "Drug not found" });

    const stocks = await DrugStock.find({ drug: req.params.drugId })
      .sort({ expiryDate: 1 })
      .populate("addedBy", "name");

    const totalStock = await DrugStock.getTotalStock(req.params.drugId);

    res.status(200).json({
      success: true,
      drug: {
        _id: drug._id,
        drugId: drug.drugId,
        name: drug.name,
        reorderLevel: drug.reorderLevel,
      },
      totalStock,
      isLowStock: totalStock <= drug.reorderLevel,
      count: stocks.length,
      stocks,
    });
  } catch (error) {
    console.error("getStocksByDrug error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── GET single stock entry ──────────────────────────────────────
// GET /api/stocks/:id
export const getStock = async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: `Invalid id: "${req.params.id}"` });

    const stock = await DrugStock.findById(req.params.id)
      .populate("drug", "drugId name brand form strength unit")
      .populate("addedBy", "name")
      .populate("lastUpdatedBy", "name");

    if (!stock)
      return res
        .status(404)
        .json({ success: false, message: "Stock entry not found" });

    res.status(200).json({ success: true, stock });
  } catch (error) {
    console.error("getStock error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── UPDATE stock entry (correct mistakes, update price/dates) ──
// PUT /api/stocks/:id
// Note: remainingQty should not be directly edited — use dispense flow
export const updateStock = async (req, res) => {
  try {
    const stock = await DrugStock.findById(req.params.id);
    if (!stock)
      return res
        .status(404)
        .json({ success: false, message: "Stock entry not found" });

    if (stock.status === "exhausted")
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot edit an exhausted stock entry",
        });

    const allowedFields = [
      "unitPrice",
      "expiryDate",
      "manufacturedDate",
      "receivedDate",
      "status",
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) stock[field] = req.body[field];
    });

    stock.lastUpdatedBy = req.user._id;
    await stock.save();

    res
      .status(200)
      .json({ success: true, message: "Stock entry updated", stock });
  } catch (error) {
    console.error("updateStock error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── DELETE a stock entry (only if not yet used) ─────────────────
// DELETE /api/stocks/:id
export const deleteStock = async (req, res) => {
  try {
    const stock = await DrugStock.findById(req.params.id);
    if (!stock)
      return res
        .status(404)
        .json({ success: false, message: "Stock entry not found" });

    if (stock.remainingQty !== stock.receivedQty)
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete a stock entry that has already been partially dispensed",
      });

    await stock.deleteOne();
    res.status(200).json({ success: true, message: "Stock entry deleted" });
  } catch (error) {
    console.error("deleteStock error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// ── DASHBOARD SUMMARY ──────────────────────────────────────────
// GET /api/stocks/dashboard
// Returns aggregated stats for the pharmacist dashboard
export const getStockDashboard = async (req, res) => {
  try {
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(now.getDate() + 30);

    // Total active drugs in catalog
    const totalDrugs = await Drug.countDocuments({ isActive: true });

    // Get ALL active drugs
    const allActiveDrugs = await Drug.find(
      { isActive: true },
      "drugId name brand form strength unit reorderLevel unitPrice",
    );

    // All active stocks
    const activeStocks = await DrugStock.find({ status: "active" }).populate(
      "drug",
      "drugId name brand form strength unit reorderLevel unitPrice",
    );

    // Build per-drug totals
    const drugTotalMap = {};
    for (const drug of allActiveDrugs) {
      const id = drug._id.toString();
      drugTotalMap[id] = {
        drug,
        totalStock: 0,
        reorderLevel: drug.reorderLevel || 10,
      };
    }

    // Add active stock quantities
    for (const entry of activeStocks) {
      const id = entry.drug?._id?.toString();
      if (!id || !drugTotalMap[id]) continue;
      drugTotalMap[id].totalStock += entry.remainingQty;
    }

    const drugTotals = Object.values(drugTotalMap);
    const lowStock = drugTotals.filter(
      (d) => d.totalStock < d.reorderLevel && d.totalStock > 0,
    );
    const outOfStock = drugTotals.filter((d) => d.totalStock === 0);

    // Expiring soon (within 30 days)
    const expiringSoon = await DrugStock.find({
      status: "active",
      expiryDate: { $gt: now, $lte: in30Days },
    })
      .sort({ expiryDate: 1 })
      .populate("drug", "drugId name brand form strength unit");

    // Already expired but not yet marked (safety catch)
    const expiredCount = await DrugStock.countDocuments({
      status: "expired",
    });

    // Total stock value
    const valueAgg = await DrugStock.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$remainingQty", "$unitPrice"] } },
        },
      },
    ]);
    const totalStockValue = valueAgg[0]?.totalValue ?? 0;

    res.status(200).json({
      success: true,
      dashboard: {
        totalDrugs,
        totalLowStock: lowStock.length,
        totalOutOfStock: outOfStock.length,
        totalExpiringSoon: expiringSoon.length,
        totalExpired: expiredCount,
        totalStockValue,
        lowStockDrugs: lowStock,
        outOfStockDrugs: outOfStock,
        expiringSoon,
      },
    });
  } catch (error) {
    console.error("getStockDashboard error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};