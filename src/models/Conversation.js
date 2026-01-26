const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    // Store the member and instructor explicitly for easier querying
    member: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    instructor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastMessage: {
        content: {
            type: String,
            trim: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date
        }
    },
    unreadCount: {
        // Unread count for each participant
        member: {
            type: Number,
            default: 0
        },
        instructor: {
            type: Number,
            default: 0
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ member: 1 });
conversationSchema.index({ instructor: 1 });
conversationSchema.index({ 'lastMessage.createdAt': -1 });

// Compound index to ensure unique conversations between member and instructor
conversationSchema.index({ member: 1, instructor: 1 }, { unique: true });

// Virtual to get the other participant
conversationSchema.methods.getOtherParticipant = function (userId) {
    return this.participants.find(p => p.toString() !== userId.toString());
};

// Method to increment unread count
conversationSchema.methods.incrementUnread = async function (recipientRole) {
    if (recipientRole === 'member') {
        this.unreadCount.member += 1;
    } else {
        this.unreadCount.instructor += 1;
    }
    await this.save();
};

// Method to reset unread count
conversationSchema.methods.resetUnread = async function (userRole) {
    if (userRole === 'member') {
        this.unreadCount.member = 0;
    } else {
        this.unreadCount.instructor = 0;
    }
    await this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);
