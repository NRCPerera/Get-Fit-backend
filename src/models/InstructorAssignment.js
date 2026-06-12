const mongoose = require('mongoose');

const instructorAssignmentSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['free', 'paid'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired'],
    default: 'active',
    index: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelledBy: {
    type: String,
    enum: ['member', 'instructor', 'admin'],
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

instructorAssignmentSchema.index({ memberId: 1, instructorId: 1 }, { unique: true });
instructorAssignmentSchema.index({ memberId: 1, status: 1 });
instructorAssignmentSchema.index({ instructorId: 1, status: 1 });

instructorAssignmentSchema.virtual('member', {
  ref: 'User',
  localField: 'memberId',
  foreignField: '_id',
  justOne: true,
});

instructorAssignmentSchema.virtual('instructor', {
  ref: 'User',
  localField: 'instructorId',
  foreignField: '_id',
  justOne: true,
});

module.exports = mongoose.model('InstructorAssignment', instructorAssignmentSchema);
