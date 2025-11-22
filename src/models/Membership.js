const mongoose = require('mongoose');

const MEMBERSHIP_STATUS = ['active', 'pending', 'expired', 'cancelled'];

const membershipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  durationDays: { type: Number, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'usd', uppercase: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: MEMBERSHIP_STATUS, default: 'active', index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  autoRenew: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Membership', membershipSchema);

