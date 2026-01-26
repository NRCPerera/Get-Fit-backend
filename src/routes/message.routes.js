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

const { verifyToken } = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');

// Middleware to allow only members and instructors
const requireMemberOrInstructor = checkRole(['member', 'instructor']);

// Get all conversations for current user
router.get('/conversations', verifyToken, requireMemberOrInstructor, getConversations);

// Get unread message count
router.get('/unread-count', verifyToken, requireMemberOrInstructor, getUnreadCount);

// Get or create conversation with a specific user
router.get('/conversations/with/:recipientId', verifyToken, requireMemberOrInstructor, getOrCreateConversation);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', verifyToken, requireMemberOrInstructor, getMessages);

// Send a message in a conversation
router.post('/conversations/:conversationId/messages', verifyToken, requireMemberOrInstructor, sendMessage);

// Mark conversation as read
router.put('/conversations/:conversationId/read', verifyToken, requireMemberOrInstructor, markConversationAsRead);

// Delete a message
router.delete('/messages/:messageId', verifyToken, requireMemberOrInstructor, deleteMessage);

module.exports = router;

