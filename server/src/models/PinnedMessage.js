import mongoose from 'mongoose';

const pinnedMessageSchema = new mongoose.Schema({
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveChatMessage',
    required: true,
    unique: true
  },
  pinnedBy: {
    type: String,
    default: 'Professor'
  }
}, {
  timestamps: true
});

export default mongoose.model('PinnedMessage', pinnedMessageSchema);
