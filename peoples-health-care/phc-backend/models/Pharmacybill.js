import mongoose from 'mongoose';

const billLineSchema = new mongoose.Schema({
  medicationName: { type: String, required: true },
  drugId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', default: null },
  qtyDispensed:   { type: Number, required: true, min: 0 },
  unitPrice:      { type: Number, required: true, min: 0 },
  lineTotal:      { type: Number, required: true, min: 0 },
  stockEntries:   [{ stockId: String, deducted: Number }],
}, { _id: true });

const labLineSchema = new mongoose.Schema({
  testName:  { type: String, required: true },
  price:     { type: Number, required: true, min: 0 },
  isOther:   { type: Boolean, default: false },
}, { _id: true });

const unavailableLineSchema = new mongoose.Schema({
  medicationName:  { type: String, required: true },
  dosage:          { type: String, default: '' },
  duration:        { type: String, default: '' },
  availability:    { type: String, default: 'out_of_stock' },
  pharmacistNote:  { type: String, default: '' },
}, { _id: true });

const pharmacyBillSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },

  pharmacyPrescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PharmacyPrescription',
    required: true,
    unique: true,
  },

  prescriptionRef: { type: String, required: true },
  patientName:     { type: String, required: true },
  patientId:       { type: String, default: '' },
  doctorName:      { type: String, required: true },
  channelingNo:    { type: String, default: '' },

  lines: { type: [billLineSchema], default: [] },

  labLines:    { type: [labLineSchema], default: [] },
  hasLabTests: { type: Boolean, default: false },

  unavailableLines: { type: [unavailableLineSchema], default: [] },
  hasUnavailable:   { type: Boolean, default: false },

  doctorCharge: { type: Number, default: 1000 },
  labTotal:     { type: Number, default: 0 },
  subtotal:     { type: Number, required: true, default: 0 },
  discount:     { type: Number, default: 0 },
  totalAmount:  { type: Number, required: true, default: 0 },

  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'no_charge'],
    default: 'unpaid',
  },

  paymentMethod: { type: String, default: '' },
  paidAt:        { type: Date, default: null },
  collectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ── Cashier sends bill to patient portal ──────────────────
  sentToPatient: { type: Boolean, default: false },
  sentAt:        { type: Date, default: null },
  sentBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ── Cashier notifies laboratory of paid lab tests ──────────
  labNotified:   { type: Boolean, default: false },
  labNotifiedAt: { type: Date, default: null },
  labNotifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  hasNote:     { type: Boolean, default: false },
  noteContent: { type: String, default: '' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

pharmacyBillSchema.index({ paymentStatus: 1 });
pharmacyBillSchema.index({ patientId: 1 });
pharmacyBillSchema.index({ createdAt: -1 });
pharmacyBillSchema.index({ sentToPatient: 1 });

pharmacyBillSchema.statics.generateBillNumber = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({
    billNumber: new RegExp(`^BILL-${year}-`)
  }).sort({ createdAt: -1 });

  let seq = 1;
  if (last?.billNumber) {
    const n = parseInt(last.billNumber.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }

  return `BILL-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('PharmacyBill', pharmacyBillSchema);