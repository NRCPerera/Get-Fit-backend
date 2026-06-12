const ApiError = require('../utils/ApiError');
const Notification = require('../models/Notification');
const NotificationRead = require('../models/NotificationRead');
const User = require('../models/User');
const logger = require('../utils/logger');

const getAudienceFilter = (user) => ({
  isActive: true,
  $or: [
    { targetAudience: 'all' },
    { targetAudience: user.role },
  ],
});

const createNotification = async (req, res, next) => {
  try {
    const { title, message, link, linkText, targetAudience, priority, isActive } = req.body;

    if (!title || !message) {
      return next(new ApiError('Title and message are required', 400));
    }

    const validAudiences = ['member', 'instructor', 'all'];
    const audiences = Array.isArray(targetAudience) ? targetAudience : [targetAudience || 'all'];
    const invalidAudiences = audiences.filter((a) => !validAudiences.includes(a));
    if (invalidAudiences.length > 0) {
      return next(new ApiError(`Invalid target audience: ${invalidAudiences.join(', ')}`, 400));
    }

    const notification = await Notification.create({
      title,
      message,
      link: link || null,
      linkText: linkText || null,
      targetAudience: audiences,
      priority: priority || 'medium',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification },
    });
  } catch (err) {
    logger.error('Error creating notification:', err);
    next(err);
  }
};

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
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items: notifications,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Error getting notifications:', err);
    next(err);
  }
};

const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate('createdBy', 'name email');

    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    const reads = await NotificationRead.find({ notificationId: id })
      .populate('userId', 'name email')
      .sort({ readAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        notification,
        reads,
        readCount: reads.length,
      },
    });
  } catch (err) {
    logger.error('Error getting notification:', err);
    next(err);
  }
};

const updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, message, link, linkText, targetAudience, priority, isActive } = req.body;

    const notification = await Notification.findById(id);
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

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

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: { notification },
    });
  } catch (err) {
    logger.error('Error updating notification:', err);
    next(err);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    await NotificationRead.deleteMany({ notificationId: id });
    await notification.deleteOne();

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (err) {
    logger.error('Error deleting notification:', err);
    next(err);
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    const filter = getAudienceFilter(user);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, readRecords] = await Promise.all([
      Notification.find(filter)
        .populate('createdBy', 'name')
        .sort({ sentAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter),
      NotificationRead.find({ userId: req.user.id }).lean(),
    ]);

    const readMap = new Map(
      readRecords.map((record) => [record.notificationId.toString(), record.readAt])
    );

    let notificationsWithReadStatus = notifications.map((notif) => {
      const readAt = readMap.get(notif._id.toString()) || null;
      return {
        ...notif,
        isRead: !!readAt,
        readAt,
      };
    });

    if (unreadOnly === 'true') {
      notificationsWithReadStatus = notificationsWithReadStatus.filter((notif) => !notif.isRead);
    }

    res.json({
      success: true,
      data: {
        items: notificationsWithReadStatus,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    logger.error('Error getting user notifications:', err);
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return next(new ApiError('Notification not found', 404));
    }

    await NotificationRead.findOneAndUpdate(
      { notificationId: id, userId: req.user.id },
      { readAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (err) {
    logger.error('Error marking notification as read:', err);
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    const notifications = await Notification.find(getAudienceFilter(user)).select('_id').lean();
    const now = new Date();

    const ops = notifications.map((notif) => ({
      updateOne: {
        filter: { notificationId: notif._id, userId: req.user.id },
        update: { $set: { readAt: now } },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await NotificationRead.bulkWrite(ops);
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { count: notifications.length },
    });
  } catch (err) {
    logger.error('Error marking all notifications as read:', err);
    next(err);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    const notifications = await Notification.find(getAudienceFilter(user)).select('_id').lean();
    const readRecords = await NotificationRead.find({
      userId: req.user.id,
      notificationId: { $in: notifications.map((n) => n._id) },
    }).select('notificationId').lean();

    const unreadCount = Math.max(notifications.length - readRecords.length, 0);

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    logger.error('Error getting unread count:', err);
    next(err);
  }
};

const registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return next(new ApiError('Push token is required', 400));
    }

    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      return next(new ApiError('Invalid Expo push token format', 400));
    }

    await User.findByIdAndUpdate(req.user.id, { expoPushToken: token });

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (err) {
    logger.error('Error registering push token:', err);
    next(err);
  }
};

const removePushToken = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { expoPushToken: null });

    res.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (err) {
    logger.error('Error removing push token:', err);
    next(err);
  }
};

module.exports = {
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  registerPushToken,
  removePushToken,
};
