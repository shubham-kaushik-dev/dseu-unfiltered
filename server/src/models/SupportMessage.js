import mongoose from 'mongoose';

const supportMessageSchema = new mongoose.Schema({
  browserToken: {
    type: String,
    required: true,
    index: true
  },
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  text: {
    type: String,
    maxlength: 1000
  },
  imageUrl: {
    type: String,
    default: ''
  },
  isSeen: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model('SupportMessage', supportMessageSchema);
