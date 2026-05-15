import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  dosage:       { type: String, required: true },
  frequency:    { type: String, default: '' },
  duration:     { type: String, required: true },
  instructions: { type: String, default: '' },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({

  prescriptionId: { type: String, required: true, unique: true },

  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorName: { type: String, required: true },

  patientId:    { type: String, default: null },
  patientName:  { type: String, required: true },
  // ── Link back to the appointment this prescription was issued for ──
  appointmentId: { type: String, default: null },   // e.g. "APT-2026-0001"

  // Medications only — lab tests live in LabRequest now
  // medications can be empty for lab-only prescriptions
  medications:   { type: [medicationSchema], default: [] },
  clinicalNotes: { type: String, default: '' },

  // Optional link to a lab request if doctor also requested tests
  labRequestId:  { type: mongoose.Schema.Types.ObjectId, ref: 'LabRequest', default: null },
  labRequestRef: { type: String, default: null }, // e.g. "LR-2026-0001"

  // Pharmacy status
  pharmacyStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'dispensed', 'cancelled'],
    default: 'pending',
  },
  dispensedAt: { type: Date, default: null },
  dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

prescriptionSchema.index({ doctorId: 1, createdAt: -1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ appointmentId: 1 });
prescriptionSchema.index({ pharmacyStatus: 1 });

prescriptionSchema.statics.generatePrescriptionId = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({ prescriptionId: new RegExp(`^RX-${year}-`) }).sort({ createdAt: -1 });
  let seq = 1;
  if (last?.prescriptionId) {
    const n = parseInt(last.prescriptionId.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `RX-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('Prescription', prescriptionSchema);