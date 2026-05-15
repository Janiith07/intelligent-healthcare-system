import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({

  date:     { type: String, required: true },
  reason:   { type: String, default: '' },

  // 'Morning' | 'Evening' | 'Both'
  // 'Both' = full day closed (Poya, public holiday, etc.)
  // 'Morning' or 'Evening' = only that session is blocked
  session: {
    type: String,
    enum: ['Morning', 'Evening', 'Both'],
    default: 'Both',
  },

  // 'holiday' = public/poya holiday | 'unavailable' = doctor unavailable
  type: {
    type: String,
    enum: ['holiday', 'unavailable'],
    default: 'unavailable',
  },

  // Optional – populated when a logged-in doctor marks it via the API.
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

// Compound unique: same date can have Morning AND Evening blocked separately,
// but not duplicates of the same (date + session) combo
holidaySchema.index({ date: 1, session: 1 }, { unique: true });

export default mongoose.model('Holiday', holidaySchema);