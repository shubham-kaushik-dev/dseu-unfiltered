import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  browserToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String,
    required: true,
    unique: true
  },
  campus: {
    type: String,
    default: 'DSEU',
    index: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: ''
  },
  bannedBy: {
    type: String,
    default: ''
  },
  banDate: {
    type: Date,
    default: null
  },
  isShadowBanned: {
    type: Boolean,
    default: false
  },
  adminNotes: {
    type: String,
    default: ''
  },
  warnings: [{
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now }
  }],
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'admin']
  },
  browser: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  },
  mutedUntil: {
    type: Date,
    default: null
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);
