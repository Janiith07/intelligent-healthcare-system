import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      unique: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    rating: {
      type: Number,
      required: false,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      default: null,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate feedbackId before saving (e.g. FB-001, FB-002, ...)
// Uses the highest existing feedbackId number + 1 to avoid duplicates after deletions
feedbackSchema.pre('save', async function (next) {
  if (!this.feedbackId) {
    try {
      const last = await mongoose.model('Feedback')
        .findOne({ feedbackId: { $exists: true } })
        .sort({ feedbackId: -1 })
        .select('feedbackId')
        .lean();

      let nextNum = 1;
      if (last?.feedbackId) {
        const parsed = parseInt(last.feedbackId.replace('FB-', ''), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }

      this.feedbackId = `FB-${String(nextNum).padStart(3, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;