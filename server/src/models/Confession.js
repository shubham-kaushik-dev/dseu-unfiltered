import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const confessionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 2000
  },
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
  reactions: {
    type: Map,
    of: [String], // Map of Unicode Emoji -> Array of browserTokens
    default: {}
  },
  comments: [commentSchema],
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

export default mongoose.model('Confession', confessionSchema);
