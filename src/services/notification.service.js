const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Send a push notification to a user via Expo Push Notification service
 * @param {string} userId - The user ID to send notification to
 * @param {string} title - Notification title
 * @param {string} message - Notification body/message
 * @param {object} data - Additional data to include (type, relatedId, etc.)
 */
const sendPushNotification = async (userId, title, message, data = {}) => {
  try {
    // Always save to database notifications
    await Notification.create({
      userId,
      title,
      message,
      type: data.type,
      relatedId: data.relatedId
    });

    // Get user's Expo push token
    const user = await User.findById(userId).select('expoPushToken');

    if (!user?.expoPushToken) {
      logger.debug(`No Expo push token for user ${userId}, skipping push notification`);
      return true;
    }

    // Send to Expo Push Notification service
    const expoPushMessage = {
      to: user.expoPushToken,
      sound: 'default',
      title: title,
      body: message,
      data: {
        ...data,
        userId
      },
      priority: 'high',
      channelId: data.type === 'message' ? 'messages' : 'default'
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoPushMessage),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      logger.error(`Expo push error for user ${userId}:`, result.data.message);

      // If token is invalid, remove it from the user
      if (result.data.details?.error === 'DeviceNotRegistered') {
        await User.findByIdAndUpdate(userId, { expoPushToken: null });
        logger.info(`Removed invalid push token for user ${userId}`);
      }
    } else {
      logger.debug(`Push notification sent to user ${userId}`);
    }

    return true;
  } catch (error) {
    logger.error('Error sending push notification:', error.message);
    return false;
  }
};

/**
 * Send push notifications to multiple users
 * @param {array} userIds - Array of user IDs
 * @param {object} notification - Notification object with title, message, type, relatedId
 */
const sendToMultipleUsers = async (userIds, notification) => {
  try {
    // Create database notifications for all users
    await Promise.all(userIds.map(id =>
      Notification.create({
        userId: id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        relatedId: notification.relatedId
      })
    ));

    // Get all users with push tokens
    const users = await User.find({
      _id: { $in: userIds },
      expoPushToken: { $ne: null }
    }).select('_id expoPushToken');

    if (users.length === 0) {
      logger.debug('No users with push tokens found');
      return true;
    }

    // Create Expo push messages
    const expoPushMessages = users.map(user => ({
      to: user.expoPushToken,
      sound: 'default',
      title: notification.title,
      body: notification.message,
      data: {
        type: notification.type,
        relatedId: notification.relatedId,
        userId: user._id.toString()
      },
      priority: 'high'
    }));

    // Send to Expo in batches (Expo recommends max 100 per request)
    const batchSize = 100;
    for (let i = 0; i < expoPushMessages.length; i += batchSize) {
      const batch = expoPushMessages.slice(i, i + batchSize);

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });
    }

    logger.debug(`Push notifications sent to ${users.length} users`);
    return true;
  } catch (error) {
    logger.error('Error sending multiple push notifications:', error.message);
    return false;
  }
};

/**
 * Send a message notification to a user
 * @param {string} recipientId - The recipient user ID
 * @param {string} senderName - The sender's name
 * @param {string} messagePreview - Preview of the message content
 * @param {string} conversationId - The conversation ID
 */
const sendMessageNotification = async (recipientId, senderName, messagePreview, conversationId) => {
  const title = `New message from ${senderName}`;
  const truncatedMessage = messagePreview.length > 50
    ? messagePreview.substring(0, 50) + '...'
    : messagePreview;

  return sendPushNotification(recipientId, title, truncatedMessage, {
    type: 'message',
    relatedId: conversationId,
    conversationId,
    senderName
  });
};

/**
 * Register or update a user's Expo push token
 * @param {string} userId - The user ID
 * @param {string} token - The Expo push token
 */
const registerPushToken = async (userId, token) => {
  try {
    await User.findByIdAndUpdate(userId, { expoPushToken: token });
    logger.info(`Registered push token for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error registering push token:', error.message);
    return false;
  }
};

/**
 * Remove a user's push token (for logout)
 * @param {string} userId - The user ID
 */
const removePushToken = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { expoPushToken: null });
    logger.info(`Removed push token for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error removing push token:', error.message);
    return false;
  }
};

module.exports = {
  sendPushNotification,
  sendToMultipleUsers,
  sendMessageNotification,
  registerPushToken,
  removePushToken
};
