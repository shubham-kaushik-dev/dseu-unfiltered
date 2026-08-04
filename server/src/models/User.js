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
