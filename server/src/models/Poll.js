import mongoose from 'mongoose';

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  votes: {
    type: [String], // Array of user browserTokens
    default: []
  }
});

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    maxlength: 300
  },
  options: [pollOptionSchema],
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campus: {
    type: String,
    default: 'DSEU',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'trash'],
    default: 'active'
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

export default mongoose.model('Poll', pollSchema);
