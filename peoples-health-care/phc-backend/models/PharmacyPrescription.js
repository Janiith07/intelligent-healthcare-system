import mongoose from 'mongoose';

/*
 * PharmacyPrescription
 * --------------------
 * Created when a doctor's Prescription reaches the pharmacy.
 * The pharmacist reviews each medication line, checks stock,
 * adds notes if a drug is unavailable, and marks it dispensed.
 * On dispense → stock is automatically reduced (see post-save hook).
 */

// ── Sub-schema: one line per medication in the prescription ─────
const prescriptionLineSchema = new mongoose.Schema(
  {
    // Copied from the doctor's medication entry
    medicationName: { type: String, required: true },
    dosage:         { type: String, required: true },
    duration:       { type: String, required: true },

    // Linked drug from the Drug inventory (null if not found)
    drugId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drug',
      default: null,
    },

    // Quantity to dispense (pharmacist calculates based on duration)
    qtyToDispense: { type: Number, default: 0, min: 0 },

    // Availability status set by pharmacist
    availability: {
      type: String,
      enum: ['available', 'out_of_stock', 'not_in_formulary'],
      default: 'available',
    },

    // Pharmacist note — required when availability !== 'available'
    pharmacistNote: { type: String, default: '' },

    // Whether stock was actually deducted for this line
    stockDeducted: { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Main schema ─────────────────────────────────────────────────
const pharmacyPrescriptionSchema = new mongoose.Schema(
  {
    // Reference to the original doctor's Prescription
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      required: true,
      unique: true,   // one pharmacy record per prescription
    },
    prescriptionRef: { type: String, required: true }, // e.g. "RX-2026-0001"

    // Copied patient info (for quick display)
    patientName:  { type: String, required: true },
    patientId:    { type: String, default: null },
    doctorName:   { type: String, required: true },

    // Medication lines reviewed by pharmacist
    lines: {
      type:     [prescriptionLineSchema],
      required: true,
      validate: { validator: v => v.length > 0, message: 'At least one medication line required' },
    },

    // Overall pharmacy status
    status: {
      type: String,
      enum: ['pending', 'in_review', 'partially_available', 'dispensed', 'cancelled'],
      default: 'pending',
    },

    // Pharmacist who handled this
    pharmacistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Timestamps for workflow
    reviewedAt:  { type: Date, default: null },
    dispensedAt: { type: Date, default: null },

    // Overall note on the prescription (optional)
    generalNote: { type: String, default: '' },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────
pharmacyPrescriptionSchema.index({ status: 1 });
pharmacyPrescriptionSchema.index({ patientId: 1 });
pharmacyPrescriptionSchema.index({ pharmacistId: 1, createdAt: -1 });

// ── Virtual: has any unavailable drugs? ─────────────────────────
pharmacyPrescriptionSchema.virtual('hasUnavailableDrugs').get(function () {
  return this.lines.some(l => l.availability !== 'available');
});

// ── Pre-save: auto-set status to 'partially_available' ──────────
pharmacyPrescriptionSchema.pre('save', function (next) {
  if (this.status === 'in_review' || this.status === 'pending') {
    const hasUnavailable = this.lines.some(l => l.availability !== 'available');
    if (hasUnavailable) this.status = 'partially_available';
  }
  next();
});

/*
 * ── STATIC: dispense()  ──────────────────────────────────────────
 *
 * Call this instead of saving directly when the pharmacist
 * clicks "Complete / Dispense".
 *
 * What it does:
 *  1. Marks each 'available' line as stockDeducted = true
 *  2. Reduces Drug.stockQty for those lines
 *  3. Sets status = 'dispensed' + dispensedAt timestamp
 *  4. Saves the PharmacyPrescription document
 *  5. Updates the parent Prescription.pharmacyStatus = 'dispensed'
 *
 * Usage (in controller):
 *   const pp = await PharmacyPrescription.findById(id).populate('lines.drugId');
 *   await PharmacyPrescription.dispense(pp, pharmacistId);
 */
pharmacyPrescriptionSchema.statics.dispense = async function (pharmacyPrescription, pharmacistId) {
  const Drug         = mongoose.model('Drug');
  const Prescription = mongoose.model('Prescription');

  // Deduct stock for available lines only
  for (const line of pharmacyPrescription.lines) {
    if (line.availability === 'available' && line.drugId && line.qtyToDispense > 0 && !line.stockDeducted) {
      await Drug.findByIdAndUpdate(
        line.drugId,
        { $inc: { stockQty: -line.qtyToDispense } }
      );
      line.stockDeducted = true;
    }
  }

  pharmacyPrescription.status       = 'dispensed';
  pharmacyPrescription.dispensedAt  = new Date();
  pharmacyPrescription.pharmacistId = pharmacistId;

  await pharmacyPrescription.save();

  // Sync back to the original Prescription
  await Prescription.findByIdAndUpdate(pharmacyPrescription.prescriptionId, {
    pharmacyStatus: 'dispensed',
    dispensedAt:    pharmacyPrescription.dispensedAt,
    dispensedBy:    pharmacistId,
  });

  return pharmacyPrescription;
};

pharmacyPrescriptionSchema.set('toJSON',   { virtuals: true });
pharmacyPrescriptionSchema.set('toObject', { virtuals: true });

export default mongoose.model('PharmacyPrescription', pharmacyPrescriptionSchema);