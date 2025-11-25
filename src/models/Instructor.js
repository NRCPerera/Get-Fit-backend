const mongoose = require('mongoose');

const SPECIALIZATIONS = ['weight-loss', 'muscle-gain', 'cardio', 'yoga', 'crossfit', 'powerlifting', 'rehabilitation', 'sports-specific'];

const AvailabilitySchema = new mongoose.Schema({
  dayOfWeek: { type: String, enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], required: true },
  startTime: { type: String, trim: true },
  endTime: { type: String, trim: true },
  isAvailable: { type: Boolean, default: true }
}, { _id: false });

const CertificationSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  issuedBy: { type: String, trim: true },
  issueDate: { type: Date },
  expiryDate: { type: Date },
  certificateUrl: { type: String, trim: true }
}, { _id: false });

const StatsSchema = new mongoose.Schema({
  totalClients: { type: Number, default: 0 },
  totalSessions: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 }
}, { _id: false });

const instructorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  specializations: [{ type: String, enum: SPECIALIZATIONS, index: true }],
  experience: { type: Number, min: 0 },
  hourlyRate: { type: Number, required: true, min: 0 },
  availability: [AvailabilitySchema],
  certifications: [CertificationSchema],
  bio: { type: String, maxlength: 1000, trim: true },
  stats: { type: StatsSchema, default: () => ({}) },
  isAvailable: { type: Boolean, default: true },
  beforePhoto: {
    type: mongoose.Schema.Types.Mixed, // Mixed type to support Cloudinary object format { secure_url, public_id }
    default: null
  },
  afterPhoto: {
    type: mongoose.Schema.Types.Mixed, // Mixed type to support Cloudinary object format { secure_url, public_id }
    default: null
  }
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Virtual populate of user details
instructorSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Instructor', instructorSchema);


