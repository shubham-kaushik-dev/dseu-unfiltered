import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['sticky', 'popup', 'homepage', 'chat_top'],
    default: 'homepage'
  },
  scheduledStart: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    default: 'Professor'
  },
  status: {
    type: String,
    enum: ['active', 'trash'],
    default: 'active'
  },
  bgColor: {
    type: String,
    default: '#f3e8ff' // default light purple
  },
  textColor: {
    type: String,
    default: '#6b21a8' // default dark purple
  }
}, {
  timestamps: true
});

export default mongoose.model('Announcement', announcementSchema);
