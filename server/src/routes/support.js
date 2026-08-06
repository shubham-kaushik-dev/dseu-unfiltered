import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { parseUser } from '../middleware/auth.js';
import SupportMessage from '../models/SupportMessage.js';
import User from '../models/User.js';
import AdminNotification from '../models/AdminNotification.js';

const router = express.Router();
const getIo = (req) => req.app.get('io');

const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

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

// GET /api/support/history - Fetch support chat history
router.get('/history', parseUser, async (req, res) => {
  try {
    const token = req.user.browserToken;
    const messages = await SupportMessage.find({ browserToken: token }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching support history:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch support chat history.' });
  }
});

// POST /api/support/message - Send a message to the support chat
router.post('/message', parseUser, (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'UPLOAD_FAILED', message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const token = req.user.browserToken;
    const { text } = req.body;
    const file = req.file;

    if ((!text || text.trim() === '') && !file) {
      return res.status(400).json({ error: 'EMPTY_MESSAGE', message: 'Cannot send an empty message.' });
    }

    let imageUrl = '';

    if (file) {
      if (isCloudinaryConfigured()) {
        try {
          const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: 'dseu-unfiltered/support' },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });
          imageUrl = uploadResult.secure_url;
        } catch (cloudinaryError) {
          console.error('Support upload error:', cloudinaryError);
          return res.status(500).json({ error: 'CLOUD_UPLOAD_ERROR', message: 'Failed to save attachment.' });
        }
      } else {
        // Local dev static save
        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');

        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = path.extname(file.originalname) || '.png';
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, file.buffer);
        imageUrl = `/uploads/${filename}`;
      }
    }

    const message = await SupportMessage.create({
      browserToken: token,
      senderType: 'user',
      senderName: req.user.displayName,
      text: text ? text.trim() : '',
      imageUrl: imageUrl,
      isSeen: false
    });

    // Create live notification for admin
    await AdminNotification.create({
      text: `Support request message from ${req.user.displayName}`,
      type: 'support_request',
      data: { browserToken: token }
    });

    // Emit live events
    const io = getIo(req);
    if (io) {
      io.to(`support-${token}`).emit('support-message', message);
      io.to('admin').emit('support-message', message);
      io.to('admin').emit('admin-notification', {
        text: `Support request message from ${req.user.displayName}`,
        type: 'support_request',
        data: { browserToken: token }
      });
      io.to('admin').emit('admin-notifications-updated');
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending support message:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send support message.' });
  }
});

// POST /api/support/seen - Mark messages as seen by user
router.post('/seen', parseUser, async (req, res) => {
  try {
    const token = req.user.browserToken;
    await SupportMessage.updateMany(
      { browserToken: token, senderType: 'admin', isSeen: false },
      { $set: { isSeen: true } }
    );

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('support-messages-seen', { token });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking support messages as seen:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update seen receipts.' });
  }
});

export default router;
