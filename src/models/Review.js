const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500, trim: true }
}, { timestamps: true });

// Compound unique index: one review per user per instructor
reviewSchema.index({ instructorId: 1, userId: 1 }, { unique: true });

// After save/update, update instructor average rating in a separate collection if exists
reviewSchema.post('save', async function(doc, next) {
  try {
    // Optional: If Instructor model exists with stats.avgRating, update it
    const Instructor = mongoose.models.Instructor;
    if (Instructor) {
      const agg = await mongoose.model('Review').aggregate([
        { $match: { instructorId: doc.instructorId } },
        { $group: { _id: '$instructorId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      const avg = agg[0]?.avgRating || 0;
      await Instructor.findOneAndUpdate(
        { userId: doc.instructorId },
        { $set: { 'stats.avgRating': avg, 'stats.totalReviews': agg[0]?.count || 0 } },
        { upsert: false }
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Review', reviewSchema);


