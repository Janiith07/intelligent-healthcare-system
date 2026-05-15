import Feedback from '../models/Feedback.js';

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit feedback  (Patient only)
// @route   POST /api/feedback
// @access  Private – patient role
// ─────────────────────────────────────────────────────────────────────────────

export const submitFeedback = async (req, res) => {
  try {
    const { rating, description } = req.body;
    const patientId   = req.user.id;
    const patientName = req.user.name;

    // At least one of rating or description must be provided
    const hasRating      = rating !== undefined && rating !== null && rating !== '';
    const hasDescription = description && description.trim().length > 0;

    if (!hasRating && !hasDescription) {
      return res.status(400).json({ message: 'Please provide a star rating, a written review, or both.' });
    }
    if (hasRating && (Number(rating) < 1 || Number(rating) > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const feedback = new Feedback({
      patientId,
      patientName,
      ...(hasRating      && { rating: Number(rating) }),
      ...(hasDescription && { description: description.trim() }),
    });
    const saved    = await feedback.save();

    res.status(201).json({ message: 'Feedback submitted successfully', feedback: saved });
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current patient's own feedbacks
// @route   GET /api/feedback/my
// @access  Private – patient role
// ─────────────────────────────────────────────────────────────────────────────

//Patient views their own feedback history
export const getMyFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ patientId: req.user.id })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({ feedbacks });
  } catch (error) {
    console.error('getMyFeedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all feedback  (Cashier)
// @route   GET /api/feedback
// @access  Private – cashier role
// ─────────────────────────────────────────────────────────────────────────────
export const getAllFeedback = async (req, res) => {
  try {
    const { rating, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (rating) filter.rating = Number(rating);

    const skip = (Number(page) - 1) * Number(limit);

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v'),
      Feedback.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
      feedbacks,
    });
  } catch (error) {
    console.error('getAllFeedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get rating distribution for dashboard chart
// @route   GET /api/feedback/distribution
// @access  Private – cashier role
// ─────────────────────────────────────────────────────────────────────────────

//⭐⭐⭐⭐⭐  → 42 reviews
export const getRatingDistribution = async (req, res) => {
  try {
    const [distribution, totalReviews] = await Promise.all([
      Feedback.aggregate([
        { $match: { rating: { $ne: null, $exists: true } } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ]),
      Feedback.countDocuments({}),
    ]);

    const result = [5, 4, 3, 2, 1].map((star) => {
      const found = distribution.find((d) => d._id === star);
      return { rating: star, count: found ? found.count : 0 };
    });

    const ratedCount    = result.reduce((sum, r) => sum + r.count, 0);
    const averageRating = ratedCount === 0
      ? 0
      : result.reduce((sum, r) => sum + r.rating * r.count, 0) / ratedCount;

    res.status(200).json({
      distribution: result,
      totalReviews,
      averageRating: parseFloat(averageRating.toFixed(1)),
    });
  } catch (error) {
    console.error('getRatingDistribution error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single feedback by ID
// @route   GET /api/feedback/:id
// @access  Private – cashier role
// ─────────────────────────────────────────────────────────────────────────────

//Cashier reads one specific feedback
export const getFeedbackById = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id).select('-__v');
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
    res.status(200).json({ feedback });
  } catch (error) {
    console.error('getFeedbackById error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get mixed-rating testimonials for home page
//          3 latest 5-star, 1 latest 4-star, 1 latest 3-star, 1 latest 2-star
// @route   GET /api/feedback/public/mixed
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const getMixedTestimonials = async (req, res) => {
  try {
    const [fiveStar, fourStar, threeStar, twoStar] = await Promise.all([
      Feedback.find({ rating: 5, description: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(3)
        .select('-__v'),
      Feedback.find({ rating: 4, description: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(1)
        .select('-__v'),
      Feedback.find({ rating: 3, description: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(1)
        .select('-__v'),
      Feedback.find({ rating: 2, description: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .limit(1)
        .select('-__v'),
    ]);

    const feedbacks = [...fiveStar, ...fourStar, ...threeStar, ...twoStar];

    res.status(200).json({ feedbacks });
  } catch (error) {
    console.error('getMixedTestimonials error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

    // Patients can only delete their own feedback
    if (req.user.role === 'patient' && feedback.patientId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own feedback' });
    }

    await feedback.deleteOne();
    res.status(200).json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('deleteFeedback error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};