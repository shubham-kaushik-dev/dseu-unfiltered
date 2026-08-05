import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['new_user', 'new_report', 'support_request', 'pinned_message', 'deleted_meme', 'deleted_confession', 'deleted_poll', 'ban', 'unban'],
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model('AdminNotification', adminNotificationSchema);
