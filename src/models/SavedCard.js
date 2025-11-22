const mongoose = require('mongoose');

const savedCardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Masked card number (last 4 digits only for security)
  last4: {
    type: String,
    required: true,
    maxlength: 4
  },
  // Card brand (visa, mastercard, amex, etc.)
  brand: {
    type: String,
    required: true,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'other']
  },
  // Expiry month (1-12)
  expMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  // Expiry year (YYYY)
  expYear: {
    type: Number,
    required: true,
    min: new Date().getFullYear()
  },
  // Cardholder name
  cardholderName: {
    type: String,
    required: true,
    trim: true
  },
  // Stripe Payment Method ID (replaces encrypted cardToken)
  stripePaymentMethodId: {
    type: String,
    required: true,
    select: false // Don't include in queries by default
  },
  // Whether this is the default card
  isDefault: {
    type: Boolean,
    default: false
  },
  // Card nickname for user reference
  nickname: {
    type: String,
    trim: true,
    maxlength: 50
  }
}, {
  timestamps: true
});

// Index for faster queries
savedCardSchema.index({ userId: 1, isDefault: 1 });

// Ensure only one default card per user
savedCardSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await mongoose.model('SavedCard').updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('SavedCard', savedCardSchema);

