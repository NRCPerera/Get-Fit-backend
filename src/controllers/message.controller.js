const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Instructor = require('../models/Instructor');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');

/**
 * Get or create a conversation between current user and another user
 * Only members can initiate conversations with their subscribed instructors
 * Instructors can only message their subscribed clients
 */
const getOrCreateConversation = async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const currentUserRole = req.user.role;
        const { recipientId } = req.params;

        if (!recipientId) {
            return next(new ApiError('Recipient ID is required', 400));
        }

        // Get recipient user
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return next(new ApiError('Recipient not found', 404));
        }

        let memberId, instructorId;

        // Determine member and instructor based on roles
        if (currentUserRole === 'member' && recipient.role === 'instructor') {
            memberId = currentUserId;
            instructorId = recipientId;
        } else if (currentUserRole === 'instructor' && recipient.role === 'member') {
            memberId = recipientId;
            instructorId = currentUserId;
        } else {
            return next(new ApiError('Messaging is only allowed between members and instructors', 400));
        }

        // Verify subscription exists between member and instructor
        const subscription = await Subscription.findOne({
            memberId: memberId,
            instructorId: instructorId,
            status: 'active'
        });

        if (!subscription) {
            return next(new ApiError('You can only message instructors you are subscribed to', 403));
        }

        // Find existing conversation or create new one
        let conversation = await Conversation.findOne({
            member: memberId,
            instructor: instructorId
        }).populate('participants', 'name email profilePicture role');

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [memberId, instructorId],
                member: memberId,
                instructor: instructorId,
                lastMessage: null,
                unreadCount: {
                    member: 0,
                    instructor: 0
                }
            });

            // Populate participants
            conversation = await Conversation.findById(conversation._id)
                .populate('participants', 'name email profilePicture role');
        }

        // Get instructor details if available
        let instructorDetails = null;
        if (instructorId) {
            instructorDetails = await Instructor.findOne({ userId: instructorId })
                .select('specializations rating totalReviews');
        }

        // Format participant info
        const otherParticipant = conversation.participants.find(
            p => p._id.toString() !== currentUserId
        );

        // Get profile picture URL
        let profilePicture = null;
        if (otherParticipant?.profilePicture) {
            if (typeof otherParticipant.profilePicture === 'object' && otherParticipant.profilePicture.secure_url) {
                profilePicture = otherParticipant.profilePicture.secure_url;
            } else if (typeof otherParticipant.profilePicture === 'string' &&
                (otherParticipant.profilePicture.startsWith('http://') ||
                    otherParticipant.profilePicture.startsWith('https://'))) {
                profilePicture = otherParticipant.profilePicture;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                conversation: {
                    _id: conversation._id,
                    lastMessage: conversation.lastMessage,
                    unreadCount: currentUserRole === 'member'
                        ? conversation.unreadCount.member
                        : conversation.unreadCount.instructor,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt
                },
                otherParticipant: {
                    _id: otherParticipant._id,
                    name: otherParticipant.name,
                    email: otherParticipant.email,
                    profilePicture: profilePicture,
                    role: otherParticipant.role,
                    ...(instructorDetails && {
                        specializations: instructorDetails.specializations,
                        rating: instructorDetails.rating,
                        totalReviews: instructorDetails.totalReviews
                    })
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all conversations for the current user
 */
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { page = 1, limit = 20 } = req.query;

        const query = {
            participants: userId,
            isActive: true
        };

        const conversations = await Conversation.find(query)
            .populate('participants', 'name email profilePicture role')
            .populate('lastMessage.sender', 'name')
            .sort({ 'lastMessage.createdAt': -1, updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Conversation.countDocuments(query);

        // Get instructor details for all instructor participants
        const instructorIds = conversations.map(conv => conv.instructor);
        const instructorDetails = await Instructor.find({ userId: { $in: instructorIds } })
            .select('userId specializations rating');

        const instructorMap = {};
        instructorDetails.forEach(inst => {
            instructorMap[inst.userId.toString()] = inst;
        });

        // Format conversations
        const formattedConversations = conversations.map(conv => {
            const otherParticipant = conv.participants.find(
                p => p._id.toString() !== userId
            );

            // Get profile picture URL
            let profilePicture = null;
            if (otherParticipant?.profilePicture) {
                if (typeof otherParticipant.profilePicture === 'object' && otherParticipant.profilePicture.secure_url) {
                    profilePicture = otherParticipant.profilePicture.secure_url;
                } else if (typeof otherParticipant.profilePicture === 'string' &&
                    (otherParticipant.profilePicture.startsWith('http://') ||
                        otherParticipant.profilePicture.startsWith('https://'))) {
                    profilePicture = otherParticipant.profilePicture;
                }
            }

            const instructorInfo = instructorMap[conv.instructor?.toString()];

            return {
                _id: conv._id,
                otherParticipant: {
                    _id: otherParticipant?._id,
                    name: otherParticipant?.name,
                    email: otherParticipant?.email,
                    profilePicture: profilePicture,
                    role: otherParticipant?.role,
                    ...(instructorInfo && otherParticipant?.role === 'instructor' && {
                        specializations: instructorInfo.specializations,
                        rating: instructorInfo.rating
                    })
                },
                lastMessage: conv.lastMessage,
                unreadCount: userRole === 'member'
                    ? conv.unreadCount.member
                    : conv.unreadCount.instructor,
                updatedAt: conv.updatedAt
            };
        });

        res.status(200).json({
            success: true,
            data: formattedConversations,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get messages for a specific conversation
 */
const getMessages = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Verify user is participant in conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return next(new ApiError('Conversation not found or you are not a participant', 404));
        }

        const messages = await Message.find({
            conversationId: conversationId,
            isDeleted: false
        })
            .populate('sender', 'name email profilePicture')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Message.countDocuments({
            conversationId: conversationId,
            isDeleted: false
        });

        // Mark messages as read
        await Message.updateMany(
            {
                conversationId: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Reset unread count for current user
        if (userRole === 'member') {
            conversation.unreadCount.member = 0;
        } else {
            conversation.unreadCount.instructor = 0;
        }
        await conversation.save();

        // Format messages with proper profile picture URLs
        const formattedMessages = messages.map(msg => {
            let profilePicture = null;
            if (msg.sender?.profilePicture) {
                if (typeof msg.sender.profilePicture === 'object' && msg.sender.profilePicture.secure_url) {
                    profilePicture = msg.sender.profilePicture.secure_url;
                } else if (typeof msg.sender.profilePicture === 'string' &&
                    (msg.sender.profilePicture.startsWith('http://') ||
                        msg.sender.profilePicture.startsWith('https://'))) {
                    profilePicture = msg.sender.profilePicture;
                }
            }

            return {
                _id: msg._id,
                content: msg.content,
                messageType: msg.messageType,
                attachmentUrl: msg.attachmentUrl,
                sender: {
                    _id: msg.sender?._id,
                    name: msg.sender?.name,
                    profilePicture: profilePicture
                },
                isRead: msg.isRead,
                createdAt: msg.createdAt,
                isOwnMessage: msg.sender?._id.toString() === userId
            };
        });

        res.status(200).json({
            success: true,
            data: formattedMessages.reverse(), // Return in chronological order
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send a message in a conversation
 */
const sendMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { conversationId } = req.params;
        const { content, messageType = 'text', attachmentUrl } = req.body;

        if (!content || content.trim() === '') {
            return next(new ApiError('Message content is required', 400));
        }

        // Verify user is participant in conversation
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return next(new ApiError('Conversation not found or you are not a participant', 404));
        }

        // Verify subscription is still active
        const subscription = await Subscription.findOne({
            memberId: conversation.member,
            instructorId: conversation.instructor,
            status: 'active'
        });

        if (!subscription) {
            return next(new ApiError('Subscription is no longer active. You cannot send messages.', 403));
        }

        // Create the message
        const message = await Message.create({
            conversationId: conversationId,
            sender: userId,
            content: content.trim(),
            messageType,
            attachmentUrl
        });

        // Update conversation with last message
        conversation.lastMessage = {
            content: content.trim().substring(0, 100), // Store preview
            sender: userId,
            createdAt: new Date()
        };

        // Increment unread count for recipient
        const recipientRole = userRole === 'member' ? 'instructor' : 'member';
        if (recipientRole === 'member') {
            conversation.unreadCount.member += 1;
        } else {
            conversation.unreadCount.instructor += 1;
        }

        await conversation.save();

        // Get sender info for response
        const sender = await User.findById(userId).select('name email profilePicture');

        let profilePicture = null;
        if (sender?.profilePicture) {
            if (typeof sender.profilePicture === 'object' && sender.profilePicture.secure_url) {
                profilePicture = sender.profilePicture.secure_url;
            } else if (typeof sender.profilePicture === 'string' &&
                (sender.profilePicture.startsWith('http://') ||
                    sender.profilePicture.startsWith('https://'))) {
                profilePicture = sender.profilePicture;
            }
        }

        res.status(201).json({
            success: true,
            data: {
                _id: message._id,
                content: message.content,
                messageType: message.messageType,
                attachmentUrl: message.attachmentUrl,
                sender: {
                    _id: sender._id,
                    name: sender.name,
                    profilePicture: profilePicture
                },
                isRead: false,
                createdAt: message.createdAt,
                isOwnMessage: true
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a message (soft delete)
 */
const deleteMessage = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await Message.findOne({
            _id: messageId,
            sender: userId
        });

        if (!message) {
            return next(new ApiError('Message not found or you are not the sender', 404));
        }

        message.isDeleted = true;
        await message.save();

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get total unread message count for the user
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        const conversations = await Conversation.find({
            participants: userId,
            isActive: true
        });

        let totalUnread = 0;
        conversations.forEach(conv => {
            if (userRole === 'member') {
                totalUnread += conv.unreadCount.member || 0;
            } else {
                totalUnread += conv.unreadCount.instructor || 0;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                unreadCount: totalUnread
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark all messages in a conversation as read
 */
const markConversationAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { conversationId } = req.params;

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });

        if (!conversation) {
            return next(new ApiError('Conversation not found', 404));
        }

        // Mark all messages as read
        await Message.updateMany(
            {
                conversationId: conversationId,
                sender: { $ne: userId },
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Reset unread count
        if (userRole === 'member') {
            conversation.unreadCount.member = 0;
        } else {
            conversation.unreadCount.instructor = 0;
        }
        await conversation.save();

        res.status(200).json({
            success: true,
            message: 'Conversation marked as read'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getOrCreateConversation,
    getConversations,
    getMessages,
    sendMessage,
    deleteMessage,
    getUnreadCount,
    markConversationAsRead
};
