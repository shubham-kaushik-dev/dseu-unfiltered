import express from 'express';
import Confession from '../models/Confession.js';
import Report from '../models/Report.js';
import AdminNotification from '../models/AdminNotification.js';
import { parseUser, requireAuth } from '../middleware/auth.js';
import { postingLimiter, interactionLimiter } from '../middleware/rateLimiter.js';
import { filterProfanity } from '../utils/profanity.js';

const router = express.Router();

// Helper to get socket.io instance
const getIo = (req) => req.app.get('io');

// GET /api/confessions - Get all confessions (sorted by newest)
router.get('/', parseUser, async (req, res) => {
  try {
    const confessions = await Confession.find({ status: { $ne: 'trash' } })
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName')
      .sort({ createdAt: -1 });

    res.json(confessions);
  } catch (error) {
    console.error('Error fetching confessions:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch confessions.' });
  }
});

// POST /api/confessions - Create a new confession
router.post('/', parseUser, requireAuth, postingLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Confession content is required.' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: 'TEXT_TOO_LONG', message: 'Confession cannot exceed 2000 characters.' });
    }

    // Apply profanity filter
    const sanitizedText = filterProfanity(text.trim());

    const confession = await Confession.create({
      text: sanitizedText,
      sender: req.user._id,
      campus: req.user.campus || 'DSEU',
      reactions: new Map()
    });

    const populatedConfession = await Confession.findById(confession._id)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // Emit live socket update to all clients
    const io = getIo(req);
    if (io) {
      io.emit('new-confession', populatedConfession);
      io.to('admin').emit('moderation-activity', {
        type: 'confession_posted',
        text: `New confession posted by ${req.user.displayName}`,
        timestamp: new Date()
      });
    }

    res.status(201).json(populatedConfession);
  } catch (error) {
    console.error('Error creating confession:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to post confession.' });
  }
});

// POST /api/confessions/:id/comment - Comment on a confession
router.post('/:id/comment', parseUser, requireAuth, postingLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    const confessionId = req.params.id;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Comment content is required.' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: 'TEXT_TOO_LONG', message: 'Comment cannot exceed 1000 characters.' });
    }

    const confession = await Confession.findById(confessionId);
    if (!confession) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Confession not found.' });
    }

    const sanitizedText = filterProfanity(text.trim());

    confession.comments.push({
      text: sanitizedText,
      sender: req.user._id
    });

    await confession.save();

    const updatedConfession = await Confession.findById(confessionId)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // Emit live socket update
    const io = getIo(req);
    if (io) {
      io.emit('confession-updated', updatedConfession);
      io.to('admin').emit('moderation-activity', {
        type: 'comment_posted',
        text: `${req.user.displayName} commented on confession #${confessionId.slice(-6)}`,
        timestamp: new Date()
      });
    }

    res.json(updatedConfession);
  } catch (error) {
    console.error('Error commenting on confession:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to post comment.' });
  }
});

// POST /api/confessions/:id/react - Toggle emoji reaction
router.post('/:id/react', parseUser, requireAuth, interactionLimiter, async (req, res) => {
  try {
    const { emoji } = req.body;
    const confessionId = req.params.id;
    const userToken = req.user.browserToken;

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Emoji is required.' });
    }

    const confession = await Confession.findById(confessionId);
    if (!confession) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Confession not found.' });
    }

    // Initialize map if needed
    if (!confession.reactions) {
      confession.reactions = new Map();
    }

    let usersList = confession.reactions.get(emoji) || [];

    if (usersList.includes(userToken)) {
      // Toggle off: remove user token
      usersList = usersList.filter(token => token !== userToken);
    } else {
      // Toggle on: add user token
      usersList.push(userToken);
    }

    // Update map
    if (usersList.length === 0) {
      confession.reactions.delete(emoji);
    } else {
      confession.reactions.set(emoji, usersList);
    }

    // Mongoose map saving trigger
    confession.markModified('reactions');
    await confession.save();

    const updatedConfession = await Confession.findById(confessionId)
      .populate('sender', 'displayName')
      .populate('comments.sender', 'displayName');

    // Emit live socket update
    const io = getIo(req);
    if (io) {
      io.emit('confession-updated', updatedConfession);
    }

    res.json(updatedConfession);
  } catch (error) {
    console.error('Error reacting to confession:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update reaction.' });
  }
});

// POST /api/confessions/:id/report - Report a confession
router.post('/:id/report', parseUser, requireAuth, interactionLimiter, async (req, res) => {
  try {
    const { reason } = req.body;
    const confessionId = req.params.id;

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Report reason is required.' });
    }

    const confession = await Confession.findById(confessionId);
    if (!confession) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Confession not found.' });
    }

    // Check if already reported by this user to prevent report spam
    const existing = await Report.findOne({
      targetType: 'confession',
      targetId: confessionId,
      reporterToken: req.user.browserToken
    });

    if (existing) {
      return res.status(400).json({ error: 'ALREADY_REPORTED', message: 'You have already reported this confession.' });
    }

    const report = await Report.create({
      targetType: 'confession',
      targetId: confessionId,
      reason: reason.trim(),
      reporterToken: req.user.browserToken
    });

    await AdminNotification.create({
      text: `Confession reported: ${reason}`,
      type: 'new_report',
      data: { reportId: report._id }
    });

    // Notify Admin via sockets in real time
    const io = getIo(req);
    if (io) {
      io.to('admin').emit('new-report', report);
      io.to('admin').emit('moderation-activity', {
        type: 'confession_reported',
        text: `Confession #${confessionId.slice(-6)} reported: "${reason}"`,
        timestamp: new Date()
      });
      
      // Update admin stats count in real time
      const totalReports = await Report.countDocuments({ status: 'pending' });
      io.to('admin').emit('admin-stats-update', { totalReports });
      io.to('admin').emit('admin-notifications-updated');
    }

    res.status(201).json({ message: 'Confession reported successfully.' });
  } catch (error) {
    console.error('Error reporting confession:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to report confession.' });
  }
});

export default router;
