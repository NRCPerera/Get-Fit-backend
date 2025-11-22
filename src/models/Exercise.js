const mongoose = require('mongoose');

const MUSCLE_GROUPS = ['chest', 'back', 'legs', 'arms', 'shoulders', 'core', 'full-body'];
const CATEGORIES = ['strength', 'cardio', 'flexibility', 'balance', 'sports'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, enum: CATEGORIES },
  difficulty: { type: String, enum: DIFFICULTIES },
  duration: { type: Number, min: 0 },
  videoUrl: { type: String, trim: true },
  imageUrl: { type: String, trim: true },
  instructions: [{ type: String, trim: true }],
  muscleGroups: [{ type: String, enum: MUSCLE_GROUPS }],
  equipment: [{ type: String, trim: true }],
  caloriesBurned: { type: Number, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

exerciseSchema.index({ category: 1 });
exerciseSchema.index({ difficulty: 1 });
exerciseSchema.index({ muscleGroups: 1 });

// Virtual: averageRating derived from reviews
exerciseSchema.virtual('averageRating').get(function() {
  // Placeholder: actual aggregation should be computed in queries if reviews exist per exercise in future
  return this._averageRating || 0;
});

module.exports = mongoose.model('Exercise', exerciseSchema);


