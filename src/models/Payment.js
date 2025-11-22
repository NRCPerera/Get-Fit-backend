const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];
const PAYMENT_METHODS = ['payhere', 'paypal', 'cash', 'mock'];

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'LKR', uppercase: true },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
  paymentMethod: { type: String, enum: PAYMENT_METHODS },
  payhereOrderId: { type: String, trim: true, index: true },
  payherePaymentId: { type: String, trim: true },
  description: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  transactionDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);


