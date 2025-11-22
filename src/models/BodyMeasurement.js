const mongoose = require('mongoose');

const bodyMeasurementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Weight in kg
  weight: {
    type: Number,
    required: true,
    min: 0
  },
  // Body measurements in cm
  chest: {
    type: Number,
    min: 0
  },
  waist: {
    type: Number,
    min: 0
  },
  hips: {
    type: Number,
    min: 0
  },
  leftArm: {
    type: Number,
    min: 0
  },
  rightArm: {
    type: Number,
    min: 0
  },
  leftThigh: {
    type: Number,
    min: 0
  },
  rightThigh: {
    type: Number,
    min: 0
  },
  neck: {
    type: Number,
    min: 0
  },
  shoulders: {
    type: Number,
    min: 0
  },
  // Body fat percentage (optional)
  bodyFatPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  // Notes or additional information
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // Measurement date (defaults to current date, but can be set)
  measurementDate: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for faster queries
bodyMeasurementSchema.index({ userId: 1, measurementDate: -1 });

module.exports = mongoose.model('BodyMeasurement', bodyMeasurementSchema);










