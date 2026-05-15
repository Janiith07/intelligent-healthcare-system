import mongoose from 'mongoose';

const turnoverReportSchema = new mongoose.Schema({
  // Unique reference e.g. TR-2026-0001
  reportNumber: { type: String, required: true, unique: true },

  // The calendar date this report covers (YYYY-MM-DD)
  reportDate: { type: String, required: true },

  // Summary figures
  totalBills:       { type: Number, required: true, default: 0 },
  paidBills:        { type: Number, required: true, default: 0 },
  unpaidBills:      { type: Number, required: true, default: 0 },
  totalCollected:   { type: Number, required: true, default: 0 },
  totalOutstanding: { type: Number, required: true, default: 0 },

  // Snapshot of individual bills at submission time
  billSnapshot: [
    {
      billNumber:    String,
      patientName:   String,
      doctorName:    String,
      totalAmount:   Number,
      paymentStatus: String,
      paidAt:        Date,
    }
  ],

  // Optional cashier note
  note: { type: String, default: '' },

  // Who submitted
  submittedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedByName: { type: String, default: '' },

  // Admin read-receipt
  readByAdmin: { type: Boolean, default: false },
  readAt:      { type: Date, default: null },

}, { timestamps: true });

turnoverReportSchema.index({ reportDate: -1 });
turnoverReportSchema.index({ submittedBy: 1 });

// Auto-generate reportNumber
turnoverReportSchema.statics.generateReportNumber = async function () {
  const year = new Date().getFullYear();
  const last = await this.findOne({ reportNumber: new RegExp(`^TR-${year}-`) }).sort({ createdAt: -1 });
  let seq = 1;
  if (last?.reportNumber) {
    const n = parseInt(last.reportNumber.split('-').pop());
    if (!isNaN(n)) seq = n + 1;
  }
  return `TR-${year}-${String(seq).padStart(4, '0')}`;
};

export default mongoose.model('TurnoverReport', turnoverReportSchema);