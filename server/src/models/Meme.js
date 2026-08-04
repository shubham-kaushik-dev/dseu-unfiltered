import mongoose from 'mongoose';

const memeCommentSchema = new mongoose.Schema({
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

const memeSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String
  },
  publicId: {
    type: String
  },
  caption: {
    type: String,
    maxlength: 200
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
  comments: [memeCommentSchema]
}, {
  timestamps: true
});

export default mongoose.model('Meme', memeSchema);
