const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

let initialized = false;
try {
  if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    initialized = true;
  }
} catch (e) {
  logger.warn('Firebase not initialized:', e.message);
}

const sendPushNotification = async (userId, title, message, data = {}) => {
  await Notification.create({ userId, title, message, type: data.type, relatedId: data.relatedId });
  if (!initialized) return;
  // Token retrieval is app-specific; placeholder no-op
  return true;
};

const sendToMultipleUsers = async (userIds, notification) => {
  await Promise.all(userIds.map(id => Notification.create({ userId: id, ...notification })));
  return true;
};

module.exports = { sendPushNotification, sendToMultipleUsers };


