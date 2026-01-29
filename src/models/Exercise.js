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
  videoUrl: {
    type: mongoose.Schema.Types.Mixed, // Mixed type to support both old string format and new object format
    default: null
  },
  imageUrl: {
    type: mongoose.Schema.Types.Mixed, // Mixed type to support both old string format and new object format
    default: null
  },
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
exerciseSchema.virtual('averageRating').get(function () {
  // Placeholder: actual aggregation should be computed in queries if reviews exist per exercise in future
  return this._averageRating || 0;
});

/**
 * Normalize video/image URLs - converts Cloudinary objects to URLs, filters out old local paths
 */
exerciseSchema.methods.getSafeUrls = function () {
  const normalizeUrl = (urlField) => {
    if (!urlField) return null;

    // Cloudinary object format
    if (typeof urlField === 'object' && urlField.secure_url) {
      return urlField.secure_url;
    }

    // String format
    if (typeof urlField === 'string') {
      // Old local path - return null (file no longer exists)
      if (urlField.startsWith('/uploads/')) {
        return null;
      }
      // Valid URL (http/https)
      if (urlField.startsWith('http://') || urlField.startsWith('https://')) {
        return urlField;
      }
    }

    return null;
  };

  return {
    videoUrl: normalizeUrl(this.videoUrl),
    imageUrl: normalizeUrl(this.imageUrl),
    // Also include full Cloudinary data if available
    videoUrlData: this.videoUrl?.public_id ? {
      secure_url: this.videoUrl.secure_url,
      public_id: this.videoUrl.public_id
    } : null,
    imageUrlData: this.imageUrl?.public_id ? {
      secure_url: this.imageUrl.secure_url,
      public_id: this.imageUrl.public_id
    } : null
  };
};

/**
 * Transform exercise for API response (includes normalized URLs)
 */
exerciseSchema.methods.toResponseObject = function () {
  const safeUrls = this.getSafeUrls();
  const exerciseObj = this.toObject();

  // Replace with normalized URLs
  exerciseObj.videoUrl = safeUrls.videoUrl;
  exerciseObj.imageUrl = safeUrls.imageUrl;

  // Add full data if needed
  if (safeUrls.videoUrlData) {
    exerciseObj.videoUrlData = safeUrls.videoUrlData;
  }
  if (safeUrls.imageUrlData) {
    exerciseObj.imageUrlData = safeUrls.imageUrlData;
  }

  return exerciseObj;
};

module.exports = mongoose.model('Exercise', exerciseSchema);


