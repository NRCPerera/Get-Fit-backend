const express = require('express');
const router = express.Router();

const {
    getOrCreateConversation,
    getConversations,
    getMessages,
    sendMessage,
    deleteMessage,
    getUnreadCount,
    markConversationAsRead
} = require('../controllers/message.controller');

const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(authenticate);

// Only members and instructors can use messaging
router.use(authorize('member', 'instructor'));

// Get all conversations for current user
router.get('/conversations', getConversations);

// Get unread message count
router.get('/unread-count', getUnreadCount);

// Get or create conversation with a specific user
router.get('/conversations/with/:recipientId', getOrCreateConversation);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send a message in a conversation
router.post('/conversations/:conversationId/messages', sendMessage);

// Mark conversation as read
router.put('/conversations/:conversationId/read', markConversationAsRead);

// Delete a message
router.delete('/messages/:messageId', deleteMessage);

module.exports = router;
