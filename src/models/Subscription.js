const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired'],
    default: 'active',
    index: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  cancelledAt: {
    type: Date
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure one active subscription per member-instructor pair
subscriptionSchema.index({ memberId: 1, instructorId: 1 }, { unique: true });

// Virtual populate
subscriptionSchema.virtual('member', {
  ref: 'User',
  localField: 'memberId',
  foreignField: '_id',
  justOne: true
});

subscriptionSchema.virtual('instructor', {
  ref: 'User',
  localField: 'instructorId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);

