const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters'],
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot be more than 1000 characters'],
  },
  link: {
    type: String,
    trim: true,
    default: null,
    validate: {
      validator: function (v) {
        if (!v) return true;
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Link must be a valid URL',
    },
  },
  linkText: {
    type: String,
    trim: true,
    maxlength: [50, 'Link text cannot be more than 50 characters'],
    default: null,
  },
  targetAudience: {
    type: [String],
    enum: ['member', 'instructor', 'all'],
    required: [true, 'Target audience is required'],
    default: ['all'],
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  pushNotificationSent: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ targetAudience: 1, isActive: 1, sentAt: -1 });
notificationSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
