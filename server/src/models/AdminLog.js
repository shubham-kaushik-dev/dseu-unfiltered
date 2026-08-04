import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  details: {
    type: String,
    required: true
  },
  adminUsername: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// TTL Index: Delete admin logs after 365 days (365 * 24 * 60 * 60 seconds)
adminLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

export default mongoose.model('AdminLog', adminLogSchema);
