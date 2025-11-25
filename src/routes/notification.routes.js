const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/role.middleware');
const {
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
} = require('../controllers/notification.controller');

// Admin routes (require admin role)
router.post('/', verifyToken, requireAdmin, createNotification);
router.get('/admin', verifyToken, requireAdmin, getAllNotifications);
router.get('/admin/:id', verifyToken, requireAdmin, getNotificationById);
router.put('/admin/:id', verifyToken, requireAdmin, updateNotification);
router.delete('/admin/:id', verifyToken, requireAdmin, deleteNotification);

// User routes (require authentication)
router.get('/me', verifyToken, getMyNotifications);
router.get('/me/unread-count', verifyToken, getUnreadCount);
router.post('/:id/read', verifyToken, markAsRead);
router.post('/me/read-all', verifyToken, markAllAsRead);

module.exports = router;

