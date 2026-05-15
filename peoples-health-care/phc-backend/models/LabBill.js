import mongoose from 'mongoose';

const labBillLineSchema = new mongoose.Schema({
  testName: { type: String, required: true },
  price:    { type: Number, required: true, min: 0 },
  isOther:  { type: Boolean, default: false },
}, { _id: true });

const labBillSchema = new mongoose.Schema({
  billNumber:   { type: String, required: true, unique: true },
  labRequestId: { type: String, required: true },           // e.g. "LR-2026-0119"
  labRequestRef:{ type: mongoose.Schema.Types.ObjectId, ref: 'LabRequest', required: true },

  patientName:  { type: String, required: true },
  patientId:    { type: String, default: '' },
  doctorName:   { type: String, required: true },
  appointmentNumber: { type: String, default: '' },

  labLines:     { type: [labBillLineSchema], default: [] },
  doctorCharge: { type: Number, default: 1000 },
  labTotal:     { type: Number, default: 0 },
  totalAmount:  { type: Number, required: true, default: 0 },

  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
  },
  paymentMethod: { type: String, default: '' },
  paidAt:        { type: Date, default: null },
  collectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Cashier sends bill to patient portal
  sentToPatient: { type: Boolean, default: false },
  sentAt:        { type: Date, default: null },
  sentBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Cashier notifies laboratory of paid lab tests
  labNotified:   { type: Boolean, default: false },
  labNotifiedAt: { type: Date, default: null },
  labNotifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

labBillSchema.index({ paymentStatus: 1 });
labBillSchema.index({ patientId: 1 });
labBillSchema.index({ createdAt: -1 });

labBillSchema.statics.generateBillNumber = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({
    billNumber: new RegExp(`^LBILL-${year}-`),
  }).sort({ createdAt: -1 });

  let seq = 1;
  if (last?.billNumber) {
    const n = parseInt(last.billNumber.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `LBILL-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('LabBill', labBillSchema);
