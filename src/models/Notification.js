const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot be more than 1000 characters']
  },
  link: {
    type: String,
    trim: true,
    default: null,
    // Validate URL format if provided
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional field
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Link must be a valid URL'
    }
  },
  linkText: {
    type: String,
    trim: true,
    maxlength: [50, 'Link text cannot be more than 50 characters'],
    default: null
  },
  targetAudience: {
    type: [String],
    enum: ['member', 'instructor', 'all'],
    required: [true, 'Target audience is required'],
    default: ['all']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  pushNotificationSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
notificationSchema.index({ targetAudience: 1, isActive: 1, sentAt: -1 });
notificationSchema.index({ createdBy: 1 });
notificationSchema.index({ 'readBy.user': 1 });

// Virtual to check if notification is read by a specific user
notificationSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(read => read.user.toString() === userId.toString());
};

// Virtual to get read count
notificationSchema.virtual('readCount').get(function() {
  return this.readBy.length;
});

module.exports = mongoose.model('Notification', notificationSchema);
