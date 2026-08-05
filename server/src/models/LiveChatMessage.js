import mongoose from 'mongoose';

const liveChatMessageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campus: {
    type: String,
    default: 'DSEU',
    index: true
  },
  reactions: {
    type: Map,
    of: [String], // Map of emoji -> list of browserTokens
    default: {
      '❤️': [],
      '😂': [],
      '🔥': []
    }
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveChatMessage',
    default: null
  },
  messageType: {
    type: String,
    enum: ['normal', 'notice'],
    default: 'normal'
  },
  isShadowBanned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'trash'],
    default: 'active'
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// TTL Index: Delete active chat messages after 30 days
// We will manage garbage collection of trash ourselves so we keep expireAfterSeconds
liveChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('LiveChatMessage', liveChatMessageSchema);
