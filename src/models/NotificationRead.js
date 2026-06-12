const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema({
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  readAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

notificationReadSchema.index({ notificationId: 1, userId: 1 }, { unique: true });
notificationReadSchema.index({ userId: 1, readAt: -1 });

module.exports = mongoose.model('NotificationRead', notificationReadSchema);
