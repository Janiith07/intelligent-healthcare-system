import mongoose from 'mongoose';

const drugSchema = new mongoose.Schema(
  {
    // ── Identification ──────────────────────────────────────────
    drugId: { type: String, required: true, unique: true }, // e.g. DRG-0001
    name:   { type: String, required: true, trim: true },
    brand:  { type: String, trim: true, default: '' },

    // ── Classification ──────────────────────────────────────────
    category: {
      type: String,
      enum: [
        'Antibiotic', 'Analgesic', 'Antifungal', 'Antiviral',
        'Antihypertensive', 'Antidiabetic', 'Antihistamine',
        'Vitamin', 'Supplement', 'Other',
      ],
      default: 'Other',
    },
    form: {
      type: String,
      enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Other'],
      required: true,
    },
    strength: { type: String, required: true }, // e.g. "500mg", "5mg/5ml"
    unit:     { type: String, default: 'pcs' }, // pcs / ml / g

    // ── Pricing (catalog default — can be overridden per stock entry) ─
    unitPrice: { type: Number, default: 0, min: 0 },

    // ── Reorder alert threshold ──────────────────────────────────
    reorderLevel: { type: Number, default: 10 },

    // ── Status ──────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // ── Audit ───────────────────────────────────────────────────
    addedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────
drugSchema.index({ name: 1 });
drugSchema.index({ category: 1 });
drugSchema.index({ isActive: 1 });

// ── Auto-generate drugId ──────────────────────────────────────────
drugSchema.statics.generateDrugId = async function () {
  const last = await this.findOne().sort({ createdAt: -1 });
  let seq = 1;
  if (last?.drugId) {
    const n = parseInt(last.drugId.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `DRG-${String(seq).padStart(4, '0')}`;
};

drugSchema.set('toJSON',   { virtuals: true });
drugSchema.set('toObject', { virtuals: true });

export default mongoose.model('Drug', drugSchema);