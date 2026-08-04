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
  }
}, {
  timestamps: true
});

// TTL Index: Delete chat messages after 30 days (30 * 24 * 60 * 60 seconds)
liveChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('LiveChatMessage', liveChatMessageSchema);
