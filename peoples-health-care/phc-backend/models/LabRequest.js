import mongoose from 'mongoose';

const labRequestSchema = new mongoose.Schema({

  labRequestId: { type: String, required: true, unique: true },

  // 'standalone' = doctor opened lab requests page directly
  // 'from_prescription' = auto-created when doctor ticked lab in prescription form
  source: {
    type: String,
    enum: ['standalone', 'from_prescription'],
    default: 'standalone',
  },

  // Only set when source = 'from_prescription'
  prescriptionRef: { type: String, default: null }, // e.g. "RX-2026-0001" — enough to identify the linked prescription

  // Who requested
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorName: { type: String, required: true },

  // Who it's for
  patientId:    { type: String, default: null },
  patientName:  { type: String, required: true },
  // Optional appointment reference
  appointmentNumber: { type: String, default: null },

  // Tests — each test has its own priority
  tests: [{
    name:     { type: String, required: true },
    isOther:  { type: Boolean, default: false },
    price:    { type: Number, default: 0 },
    priority: { type: String, enum: ['Routine', 'Urgent'], default: 'Routine' },
    _id: false,
  }],

  // Overall priority — derived (Urgent if any test is Urgent, else Routine)
  priority: { type: String, enum: ['Routine', 'Urgent'], default: 'Routine' },

  clinicalNotes:       { type: String, default: '' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending',
  },
  completedAt: { type: Date, default: null },

}, { timestamps: true });

labRequestSchema.index({ doctorId: 1, createdAt: -1 });
labRequestSchema.index({ status: 1 });
labRequestSchema.index({ prescriptionRef: 1 });

labRequestSchema.statics.generateLabRequestId = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({ labRequestId: new RegExp(`^LR-${year}-`) }).sort({ createdAt: -1 });
  let seq = 1;
  if (last?.labRequestId) {
    const n = parseInt(last.labRequestId.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `LR-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('LabRequest', labRequestSchema);