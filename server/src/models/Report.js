import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['message', 'confession', 'meme'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  reporterToken: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'resolved'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// TTL Index: Delete reports after 90 days (90 * 24 * 60 * 60 seconds)
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model('Report', reportSchema);
