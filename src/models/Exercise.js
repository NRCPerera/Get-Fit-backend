const mongoose = require('mongoose');
const { cloudinaryAssetSchema, defaultCloudinaryAsset } = require('./schemas/cloudinaryAsset.schema');

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true, maxlength: 100 },
  difficulty: { type: String, trim: true, maxlength: 100 },
  duration: { type: Number, min: 0 },
  videoUrl: {
    type: cloudinaryAssetSchema,
    default: defaultCloudinaryAsset,
  },
  imageUrl: {
    type: cloudinaryAssetSchema,
    default: defaultCloudinaryAsset,
  },
  instructions: [{ type: String, trim: true }],
  muscleGroups: [{ type: String, trim: true, maxlength: 100 }],
  equipment: [{ type: String, trim: true }],
  caloriesBurned: { type: Number, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

exerciseSchema.index({ category: 1 });
exerciseSchema.index({ difficulty: 1 });
exerciseSchema.index({ muscleGroups: 1 });

exerciseSchema.virtual('averageRating').get(function () {
  return this._averageRating || 0;
});

module.exports = mongoose.model('Exercise', exerciseSchema);
