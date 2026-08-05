import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Meme from '../models/Meme.js';
import Report from '../models/Report.js';
import { parseUser, requireAuth } from '../middleware/auth.js';
import { postingLimiter, interactionLimiter } from '../middleware/rateLimiter.js';
import { filterProfanity } from '../utils/profanity.js';

const router = express.Router();
const getIo = (req) => req.app.get('io');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Configure Cloudinary if keys are present
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Multer in-memory storage for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP are supported.'));
    }
  }
});

// GET /api/memes - Get all memes (sorted by newest)
router.get('/', parseUser, async (req, res) => {
  try {
    const memes = await Meme.find({ campus: req.user?.campus || 'DSEU', status: { $ne: 'trash' } })
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName')
      .sort({ createdAt: -1 });

    res.json(memes);
  } catch (error) {
    console.error('Error fetching memes:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch memes.' });
  }
});

// POST /api/memes - Upload a new meme
router.post('/', parseUser, requireAuth, postingLimiter, (req, res, next) => {
  // Use Multer to parse upload
  upload.single('meme')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'UPLOAD_FAILED', message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { caption } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'NO_FILE', message: 'Please select a meme image to upload.' });
    }

    let imageUrl = '';
    let cloudinaryPublicId = '';

    // 1. Handle storage logic
    if (isCloudinaryConfigured()) {
      // Upload to Cloudinary using promise-based stream upload
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'dseu-unfiltered/memes' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(file.buffer);
        });
        imageUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({ error: 'CLOUD_UPLOAD_ERROR', message: 'Failed to save meme image to cloud storage.' });
      }
    } else {
      // Cloudinary is not configured.
      // Rule check: "If Cloudinary is not configured in production, disable meme uploads and display a friendly error message instead of saving files locally. Local filesystem uploads may only be used for local development."
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        return res.status(503).json({ 
          error: 'UPLOADS_DISABLED', 
          message: 'Meme uploads are temporarily disabled. Cloud storage (Cloudinary) is not configured in this production environment.' 
        });
      }

      // Local development fallback: Save file to local disk
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate a unique filename
      const ext = path.extname(file.originalname) || '.png';
      const filename = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, file.buffer);
      
      // Construct a local development relative link
      // The frontend Vite dev server or client will read this static folder
      imageUrl = `/uploads/${filename}`;
    }

    // Apply profanity filtering to optional caption
    const sanitizedCaption = caption ? filterProfanity(caption.trim()) : '';

    // 2. Save Meme details to database
    const meme = await Meme.create({
      imageUrl: imageUrl,
      cloudinaryPublicId: cloudinaryPublicId,
      publicId: cloudinaryPublicId,
      caption: sanitizedCaption,
      sender: req.user._id,
      campus: req.user.campus || 'DSEU',
      reactions: new Map()
    });

    const populatedMeme = await Meme.findById(meme._id)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // 3. Emit real-time Socket notifications
    const io = getIo(req);
    if (io) {
      io.emit('new-meme', populatedMeme);
      io.to('admin').emit('moderation-activity', {
        type: 'meme_uploaded',
        text: `New meme uploaded by ${req.user.displayName}`,
        timestamp: new Date()
      });
      
      // Update admin stats count in real time
      const totalMemes = await Meme.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalMemes });
    }

    res.status(201).json(populatedMeme);
  } catch (error) {
    console.error('Error uploading meme:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to upload meme.' });
  }
});

// POST /api/memes/:id/comment - Comment on a meme
router.post('/:id/comment', parseUser, requireAuth, postingLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const memeId = req.params.id;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Comment content is required.' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: 'TEXT_TOO_LONG', message: 'Comment cannot exceed 1000 characters.' });
    }

    const meme = await Meme.findById(memeId);
    if (!meme) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Meme not found.' });
    }

    const sanitizedText = filterProfanity(text.trim());

    meme.comments.push({
      text: sanitizedText,
      sender: req.user._id
    });

    await meme.save();

    const updatedMeme = await Meme.findById(memeId)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // Emit live socket update
    const io = getIo(req);
    if (io) {
      io.emit('meme-updated', updatedMeme);
    }

    res.json(updatedMeme);
  } catch (error) {
    console.error('Error commenting on meme:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to post comment.' });
  }
});

// POST /api/memes/:id/react - React to a meme
router.post('/:id/react', parseUser, requireAuth, interactionLimiter, async (req, res) => {
  try {
    const { emoji } = req.body;
    const memeId = req.params.id;
    const userToken = req.user.browserToken;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Emoji is required.' });
    }

    const meme = await Meme.findById(memeId);
    if (!meme) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Meme not found.' });
    }

    if (!meme.reactions) {
      meme.reactions = new Map();
    }

    let usersList = meme.reactions.get(emoji) || [];

    if (usersList.includes(userToken)) {
      // Toggle off
      usersList = usersList.filter(token => token !== userToken);
    } else {
      // Toggle on
      usersList.push(userToken);
    }

    if (usersList.length === 0) {
      meme.reactions.delete(emoji);
    } else {
      meme.reactions.set(emoji, usersList);
    }

    meme.markModified('reactions');
    await meme.save();

    const updatedMeme = await Meme.findById(memeId)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // Emit live socket update
    const io = getIo(req);
    if (io) {
      io.emit('meme-updated', updatedMeme);
    }

    res.json(updatedMeme);
  } catch (error) {
    console.error('Error reacting to meme:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update reaction.' });
  }
});

// POST /api/memes/:id/report - Report a meme
router.post('/:id/report', parseUser, requireAuth, interactionLimiter, async (req, res) => {
  try {
    const { reason } = req.body;
    const memeId = req.params.id;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Report reason is required.' });
    }

    const meme = await Meme.findById(memeId);
    if (!meme) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Meme not found.' });
    }

    const existing = await Report.findOne({
      targetType: 'meme',
      targetId: memeId,
      reporterToken: req.user.browserToken
    });

    if (existing) {
      return res.status(400).json({ error: 'ALREADY_REPORTED', message: 'You have already reported this meme.' });
    }

    const report = await Report.create({
      targetType: 'meme',
      targetId: memeId,
      reason: reason.trim(),
      reporterToken: req.user.browserToken
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('new-report', report);
      io.to('admin').emit('moderation-activity', {
        type: 'meme_reported',
        text: `Meme #${memeId.slice(-6)} reported: "${reason}"`,
        timestamp: new Date()
      });
      
      const totalReports = await Report.countDocuments({ status: 'pending' });
      io.to('admin').emit('admin-stats-update', { totalReports });
    }

    res.status(201).json({ message: 'Meme reported successfully.' });
  } catch (error) {
    console.error('Error reporting meme:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to report meme.' });
  }
});

export default router;
