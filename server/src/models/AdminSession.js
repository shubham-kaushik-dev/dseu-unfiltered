import mongoose from 'mongoose';

const adminSessionSchema = new mongoose.Schema({
  adminUsername: {
    type: String,
    required: true
  },
  loginTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  browser: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  },
  durationSeconds: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('AdminSession', adminSessionSchema);
