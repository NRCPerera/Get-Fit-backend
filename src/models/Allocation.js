const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
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
        enum: ['active', 'cancelled'],
        default: 'active',
        index: true
    },
    allocatedAt: {
        type: Date,
        default: Date.now
    },
    cancelledAt: {
        type: Date
    },
    cancelledBy: {
        type: String,
        enum: ['member', 'instructor'],
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Ensure one active allocation per member-instructor pair
allocationSchema.index({ memberId: 1, instructorId: 1, status: 1 });

// Virtual populate
allocationSchema.virtual('member', {
    ref: 'User',
    localField: 'memberId',
    foreignField: '_id',
    justOne: true
});

allocationSchema.virtual('instructor', {
    ref: 'User',
    localField: 'instructorId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model('Allocation', allocationSchema);
