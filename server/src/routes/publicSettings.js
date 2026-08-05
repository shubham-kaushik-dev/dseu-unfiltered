import express from 'express';
import Settings from '../models/Settings.js';
import Announcement from '../models/Announcement.js';
import PinnedMessage from '../models/PinnedMessage.js';

const router = express.Router();

// GET /api/settings - Fetch global settings
router.get('/settings', async (req, res) => {
  try {
    const list = await Settings.find({});
    const settingsMap = {};
    
    // Map defaults if not set in MongoDB
    const defaults = {
      website_name: 'DSEU Unfiltered',
      website_logo: '',
      website_tagline: 'The campus talks. You stay anonymous.',
      primary_theme_color: '#8b5cf6', // Indigo/Purple
      maintenance_message: 'DSEU Unfiltered is currently undergoing scheduled maintenance. We will be back online shortly!',
      support_welcome_message: 'Hello, if you believe this ban is an error, send a message to Professor below.',
      max_upload_size: 10, // 10MB
      slow_mode_seconds: 0,
      announcement_bg_color: '#f3e8ff',
      announcement_text_color: '#6b21a8',
      enable_notifications: true
    };

    // Initialize map
    Object.keys(defaults).forEach(key => {
      settingsMap[key] = defaults[key];
    });

    list.forEach(item => {
      settingsMap[item.key] = item.value;
    });

    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch settings configurations.' });
  }
});

// GET /api/announcements - Fetch active announcements
router.get('/announcements', async (req, res) => {
  try {
    const now = new Date();
    const activeAnnouncements = await Announcement.find({
      status: 'active',
      scheduledStart: { $lte: now },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });

    res.json(activeAnnouncements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch announcements.' });
  }
});

// GET /api/chat/pinned - Fetch pinned chat message
router.get('/chat/pinned', async (req, res) => {
  try {
    const pinned = await PinnedMessage.findOne({}).populate({
      path: 'message',
      populate: { path: 'sender', select: 'displayName role' }
    });
    
    if (!pinned || !pinned.message || pinned.message.status === 'trash') {
      return res.json(null);
    }
    
    res.json(pinned.message);
  } catch (error) {
    console.error('Error fetching pinned message:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch pinned message.' });
  }
});

export default router;
