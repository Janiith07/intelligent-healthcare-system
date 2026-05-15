import mongoose from "mongoose";

const drugStockSchema = new mongoose.Schema(
  {
    // ── Link to Drug catalog ────────────────────────────────────
    drug: { type: mongoose.Schema.Types.ObjectId, ref: "Drug", required: true },

    // ── Auto-generated stock entry ID ───────────────────────────
    stockId: { type: String, unique: true }, // e.g. STK-0001

    // ── Quantity ────────────────────────────────────────────────
    receivedQty: { type: Number, required: true, min: 0 }, // qty received in this entry
    remainingQty: { type: Number, required: true, min: 0 }, // current available qty
    unitPrice: { type: Number, default: 0, min: 0 }, // purchase price for this entry

    // ── Dates ────────────────────────────────────────────────────
    manufacturedDate: { type: Date, default: null },
    expiryDate: { type: Date, required: true },
    receivedDate: { type: Date, default: Date.now },

    // ── Status ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["active", "exhausted", "expired"],
      default: "active",
    },

    // ── Audit ─────────────────────────────────────────────────────
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// ── Indexes ──────────────────────────────────────────────────────
drugStockSchema.index({ drug: 1 });
drugStockSchema.index({ expiryDate: 1 });
drugStockSchema.index({ status: 1 });
drugStockSchema.index({ drug: 1, status: 1 }); // most common query: active stock for a drug

// ── Auto-generate stockId ─────────────────────────────────────────
drugStockSchema.statics.generateStockId = async function () {
  const last = await this.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last?.stockId) {
    const n = parseInt(last.stockId.split("-").pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `STK-${String(seq).padStart(4, "0")}`;
};

// ── Static: get total available stock for a drug ─────────────────
// Returns summed remainingQty across all active, non-expired batches
drugStockSchema.statics.getTotalStock = async function (drugId) {
  const result = await this.aggregate([
    {
      $match: {
        drug: new mongoose.Types.ObjectId(drugId),
        status: "active",
        expiryDate: { $gt: new Date() },
      },
    },
    { $group: { _id: null, total: { $sum: "$remainingQty" } } },
  ]);
  return result[0]?.total ?? 0;
};

// ── Static: deduct stock using FEFO (First Expiry First Out) ─────
// Pass drugId and qty to deduct. Returns array of entries touched.
drugStockSchema.statics.deductFEFO = async function (drugId, qtyNeeded) {
  const entries = await this.find({
    drug: drugId,
    status: "active",
    remainingQty: { $gt: 0 },
    expiryDate: { $gt: new Date() },
  }).sort({ expiryDate: 1 }); // earliest expiry first

  let remaining = qtyNeeded;
  const touched = [];

  for (const entry of entries) {
    if (remaining <= 0) break;
    const deduct = Math.min(entry.remainingQty, remaining);
    entry.remainingQty -= deduct;
    if (entry.remainingQty === 0) entry.status = "exhausted";
    await entry.save();
    touched.push({ stockId: entry.stockId, deducted: deduct });
    remaining -= deduct;
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient stock — could not deduct ${remaining} more unit(s)`,
    );
  }

  return touched;
};

// ── Static: sync Drug.isActive based on total available stock ────
// totalStock > 0  → isActive = true  (back in stock → active)
// totalStock === 0 → isActive = false (out of stock → inactive)
drugStockSchema.statics.syncDrugActiveStatus = async function (drugId) {
  const Drug = mongoose.model("Drug");
  const total = await this.getTotalStock(drugId);
  await Drug.findByIdAndUpdate(drugId, { isActive: total > 0 });
  return total;
};

// ── Post-save: sync after every stock entry save ──────────────────
// Covers: new entry created, deductFEFO saves, status changes
drugStockSchema.post("save", async function () {
  try {
    await mongoose.model("DrugStock").syncDrugActiveStatus(this.drug);
  } catch (e) {
    console.error("syncDrugActiveStatus (post-save) error:", e.message);
  }
});

// ── Post-deleteOne: sync after a stock entry is deleted ───────────
drugStockSchema.post(
  "deleteOne",
  { document: true, query: false },
  async function () {
    try {
      await mongoose.model("DrugStock").syncDrugActiveStatus(this.drug);
    } catch (e) {
      console.error("syncDrugActiveStatus (post-deleteOne) error:", e.message);
    }
  },
);

// ── Virtual: is expired ───────────────────────────────────────────
drugStockSchema.virtual("isExpired").get(function () {
  if (!this.expiryDate) return false;
  return new Date() > new Date(this.expiryDate);
});

// ── Auto-mark expired entries on fetch ───────────────────────────
drugStockSchema.pre("find", function () {
  mongoose
    .model("DrugStock")
    .updateMany(
      { status: "active", expiryDate: { $lte: new Date() } },
      { status: "expired" },
    )
    .exec();
});

drugStockSchema.set("toJSON", { virtuals: true });
drugStockSchema.set("toObject", { virtuals: true });

const DrugStock =
  mongoose.models.DrugStock || mongoose.model("DrugStock", drugStockSchema);

export default DrugStock;