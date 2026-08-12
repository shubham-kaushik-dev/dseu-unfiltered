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
  realName: {
    type: String,
    default: null
  },
  passwordHash: {
    type: String,
    default: null
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  registrationDate: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  mustChangePassword: {
    type: Boolean,
    default: false
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
  sentMessageCount: {
    type: Number,
    default: 0
  },
  pushSubscriptions: [{
    endpoint: String,
    expirationTime: Number,
    keys: {
      p256dh: String,
      auth: String
    }
  }],
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
  },
  rulesAcceptedVersion: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema);
