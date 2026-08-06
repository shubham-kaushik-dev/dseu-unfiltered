import mongoose from 'mongoose';

const passwordResetRequestSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true
  },
  realName: {
    type: String,
    required: true
  },
  campus: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'completed', 'rejected']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
