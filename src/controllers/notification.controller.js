const ApiError = require('../utils/ApiError');
const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

// Admin: Create notification
const createNotification = async (req, res, next) => {
  try {
    const { title, message, link, linkText, targetAudience, priority, isActive } = req.body;

    // Validate required fields
    if (!title || !message) {
      return next(new ApiError('Title and message are required', 400));
    }

    // Validate targetAudience
    const validAudiences = ['member', 'instructor', 'all'];
    const audiences = Array.isArray(targetAudience) ? targetAudience : [targetAudience || 'all'];
    const invalidAudiences = audiences.filter(a => !validAudiences.includes(a));
    if (invalidAudiences.length > 0) {
      return next(new ApiError(`Invalid target audience: ${invalidAudiences.join(', ')}`, 400));
    }

    // Create notification
    const notification = await Notification.create({
      title,
      message,
      link: link || null,
      linkText: linkText || null,
      targetAudience: audiences,
      priority: priority || 'medium',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id
    });

    logger.info('Notification created', {
      notificationId: notification._id,
      title: notification.title,
      targetAudience: notification.targetAudience,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification }
    });
  } catch (err) {
    logger.error('Error creating notification:', err);
    next(err);
  }
};

// Admin: Get all notifications
const getAllNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, targetAudience, isActive } = req.query;
    const filter = {};

    if (targetAudience) {
      filter.targetAudience = { $in: [targetAudience, 'all'] };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('createdBy', 'name email')
        .sort({ sentAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        items: notifications,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error('Error getting notifications:', err);
    next(err);
  }
};

// Admin: Get notification by ID
const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate('createdBy', 'name email')
      .populate('readBy.user', 'name email');

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    res.json({
      success: true,
      data: { notification }
    });
  } catch (err) {
    logger.error('Error getting notification:', err);
    next(err);
  }
};

// Admin: Update notification
const updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, message, link, linkText, targetAudience, priority, isActive } = req.body;

    const notification = await Notification.findById(id);

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Update fields
    if (title !== undefined) notification.title = title;
    if (message !== undefined) notification.message = message;
    if (link !== undefined) notification.link = link;
    if (linkText !== undefined) notification.linkText = linkText;
    if (targetAudience !== undefined) {
      const audiences = Array.isArray(targetAudience) ? targetAudience : [targetAudience];
      notification.targetAudience = audiences;
    }
    if (priority !== undefined) notification.priority = priority;
    if (isActive !== undefined) notification.isActive = isActive;

    await notification.save();

    logger.info('Notification updated', {
      notificationId: notification._id,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: { notification }
    });
  } catch (err) {
    logger.error('Error updating notification:', err);
    next(err);
  }
};

// Admin: Delete notification
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    await notification.deleteOne();

    logger.info('Notification deleted', {
      notificationId: id,
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (err) {
    logger.error('Error deleting notification:', err);
    next(err);
  }
};

// User: Get my notifications
const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Build filter based on user role and target audience
    const filter = {
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: user.role }
      ]
    };

    // If unreadOnly, filter out read notifications
    if (unreadOnly === 'true') {
      filter['readBy.user'] = { $ne: req.user.id };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('createdBy', 'name')
        .sort({ sentAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter)
    ]);

    // Mark which notifications are read
    const notificationsWithReadStatus = notifications.map(notif => {
      const isRead = notif.readBy.some(
        read => read.user && read.user.toString() === req.user.id.toString()
      );
      return {
        ...notif,
        isRead,
        readAt: isRead ? notif.readBy.find(
          read => read.user && read.user.toString() === req.user.id.toString()
        )?.readAt : null
      };
    });

    res.json({
      success: true,
      data: {
        items: notificationsWithReadStatus,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error('Error getting user notifications:', err);
    next(err);
  }
};

// User: Mark notification as read
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    // Check if already read
    const alreadyRead = notification.readBy.some(
      read => read.user && read.user.toString() === req.user.id.toString()
    );

    if (!alreadyRead) {
      notification.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      await notification.save();
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (err) {
    logger.error('Error marking notification as read:', err);
    next(err);
  }
};

// User: Mark all notifications as read
const markAllAsRead = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    // Find all unread notifications for this user
    const filter = {
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: user.role }
      ],
      'readBy.user': { $ne: req.user.id }
    };

    const notifications = await Notification.find(filter);

    // Mark each as read
    const updatePromises = notifications.map(notif => {
      notif.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      return notif.save();
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { count: notifications.length }
    });
  } catch (err) {
    logger.error('Error marking all notifications as read:', err);
    next(err);
  }
};

// User: Get unread notification count
const getUnreadCount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    const filter = {
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: user.role }
      ],
      'readBy.user': { $ne: req.user.id }
    };

    const count = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: { unreadCount: count }
    });
  } catch (err) {
    logger.error('Error getting unread count:', err);
    next(err);
  }
};

// User: Register push token
const registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return next(new ApiError('Push token is required', 400));
    }

    // Validate Expo push token format
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return next(new ApiError('Invalid Expo push token format', 400));
    }

    await User.findByIdAndUpdate(req.user.id, { expoPushToken: token });

    logger.info('Push token registered', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Push token registered successfully'
    });
  } catch (err) {
    logger.error('Error registering push token:', err);
    next(err);
  }
};

// User: Remove push token (for logout)
const removePushToken = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { expoPushToken: null });

    logger.info('Push token removed', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Push token removed successfully'
    });
  } catch (err) {
    logger.error('Error removing push token:', err);
    next(err);
  }
};

module.exports = {
  // Admin endpoints
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  // User endpoints
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  registerPushToken,
  removePushToken
};

