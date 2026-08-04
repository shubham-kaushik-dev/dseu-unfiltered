import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { 
  requireAdmin, 
  checkLoginLockout, 
  registerFailedAttempt, 
  clearFailedAttempts 
} from '../middleware/adminAuth.js';
import User from '../models/User.js';
import LiveChatMessage from '../models/LiveChatMessage.js';
import Confession from '../models/Confession.js';
import Meme from '../models/Meme.js';
import Poll from '../models/Poll.js';
import Report from '../models/Report.js';
import { runDatabaseBackup } from '../utils/backup.js';
import AdminLog from '../models/AdminLog.js';
import Settings from '../models/Settings.js';
import { v2 as cloudinary } from 'cloudinary';
import { generateUniqueIdentity } from '../utils/identity.js';

// Configure Cloudinary if keys are present
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const router = express.Router();
const getIo = (req) => req.app.get('io');

// We will pre-hash the admin password from .env on startup
let hashedAdminPassword = '';
const adminUsername = process.env.ADMIN_USERNAME || 'administrator';
const adminPasswordRaw = process.env.ADMIN_PASSWORD || 'CHANGE_THIS_TO_A_STRONG_PASSWORD';

// Hash the password
const initAdminPassword = async () => {
  hashedAdminPassword = await bcrypt.hash(adminPasswordRaw, 10);
};
initAdminPassword();

// POST /api/admin/login
// Bcrypt authentication, HttpOnly cookies, rate limits and lockouts
router.post('/login', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { username, password } = req.body;

  // 1. Check if IP is currently locked out
  const lockout = checkLoginLockout(ip);
  if (lockout.isLocked) {
    return res.status(429).json({
      error: 'ADMIN_LOCKED_OUT',
      message: `Too many failed attempts. Admin login is temporarily locked. Try again in ${lockout.remainingTime} seconds.`
    });
  }

  if (!username || !password) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Username and password are required.' });
  }

  // 2. Compare credentials
  const usernameMatch = username === adminUsername;
  let passwordMatch = false;

  if (usernameMatch) {
    passwordMatch = await bcrypt.compare(password, hashedAdminPassword);
  }

  if (!usernameMatch || !passwordMatch) {
    const isLocked = registerFailedAttempt(ip);
    if (isLocked) {
      return res.status(429).json({
        error: 'ADMIN_LOCKED_OUT',
        message: 'Too many failed attempts. Admin login has been locked for 15 minutes.'
      });
    }
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
  }

  // 3. Clear failed attempts on success
  clearFailedAttempts(ip);

  // 4. Sign JWT with a secure random CSRF token
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign(
    { username: adminUsername, role: 'admin', csrfToken },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' } // 1 hour session
  );

  // 5. Set HttpOnly cookie
  res.cookie('dseu_unfiltered_admin', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000 // 1 hour
  });

  // Log action
  await AdminLog.create({
    action: 'ADMIN_LOGIN',
    details: `Admin logged in from IP ${ip}`,
    adminUsername
  });

  // Emit event to admin logs panel
  const io = getIo(req);
  if (io) {
    io.to('admin').emit('moderation-activity', {
      type: 'admin_login',
      text: `Administrator logged in from IP ${ip}`,
      timestamp: new Date()
    });
  }

  res.json({ message: 'Logged in successfully as administrator.', csrfToken });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('dseu_unfiltered_admin');
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/admin/check
router.get('/check', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, csrfToken: req.admin.csrfToken });
});

// ==========================================
// PROTECTED ADMIN ENDPOINTS
// ==========================================

// GET /api/admin/stats
// Returns comprehensive real-time dashboard analytics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Total numbers
    const totalUsers = await User.countDocuments();
    const totalChatMessages = await LiveChatMessage.countDocuments();
    const totalConfessions = await Confession.countDocuments();
    const totalMemes = await Meme.countDocuments();
    const totalPolls = await Poll.countDocuments();
    const totalReportsPending = await Report.countDocuments({ status: 'pending' });
    const totalReportsAll = await Report.countDocuments();
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const mutedUsers = await User.countDocuments({ mutedUntil: { $gt: new Date() } });

    // Today's activity
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfToday } });
    const chatMessagesToday = await LiveChatMessage.countDocuments({ createdAt: { $gte: startOfToday } });
    const confessionsToday = await Confession.countDocuments({ createdAt: { $gte: startOfToday } });
    const memesToday = await Meme.countDocuments({ createdAt: { $gte: startOfToday } });
    
    // Today's active users (who did something today or logged in)
    const todayActiveUsers = await User.countDocuments({ lastActive: { $gte: startOfToday } });

    // Fetch active sockets from Socket.IO to show online
    const io = getIo(req);
    let onlineUsersCount = 0;
    if (io) {
      onlineUsersCount = io.sockets.sockets.size;
    }

    const offlineUsersCount = Math.max(0, totalUsers - onlineUsersCount);

    // Fetch slow mode and maintenance settings
    const slowmodeSetting = await Settings.findOne({ key: 'slow_mode_seconds' });
    const slowModeSeconds = slowmodeSetting ? slowmodeSetting.value : 0;

    const maintenanceSetting = await Settings.findOne({ key: 'maintenance_mode' });
    const maintenanceMode = maintenanceSetting ? maintenanceSetting.value : false;

    const maintenanceMsgSetting = await Settings.findOne({ key: 'maintenance_message' });
    const maintenanceMessage = maintenanceMsgSetting ? maintenanceMsgSetting.value : '';

    const announcementSetting = await Settings.findOne({ key: 'pinned_announcement' });
    const pinnedAnnouncement = announcementSetting ? announcementSetting.value : '';

    res.json({
      totalUsers,
      totalChatMessages,
      totalConfessions,
      totalMemes,
      totalPolls,
      totalReports: totalReportsAll,
      totalReportsPending,
      bannedUsers,
      mutedUsers,
      onlineUsers: onlineUsersCount,
      offlineUsers: offlineUsersCount,
      todayActiveUsers,
      slowModeSeconds,
      maintenanceMode,
      maintenanceMessage,
      pinnedAnnouncement,
      today: {
        newUsers: newUsersToday,
        chatMessages: chatMessagesToday,
        confessions: confessionsToday,
        memes: memesToday
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch dashboard stats.' });
  }
});

// GET /api/admin/reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch reports.' });
  }
});

// GET /api/admin/logs
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch logs.' });
  }
});

// DELETE /api/admin/message/:id
router.delete('/message/:id', requireAdmin, async (req, res) => {
  try {
    const messageId = req.params.id;
    const msg = await LiveChatMessage.findById(messageId).populate('sender', 'displayName');
    if (!msg) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Message not found.' });
    }

    await LiveChatMessage.findByIdAndDelete(messageId);

    // Log action
    await AdminLog.create({
      action: 'DELETE_CHAT_MESSAGE',
      details: `Deleted message by ${msg.sender?.displayName || 'Unknown'}: "${msg.text.substring(0, 50)}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('message-deleted', messageId);
      io.to('admin').emit('moderation-activity', {
        type: 'message_deleted',
        text: `Message by ${msg.sender?.displayName || 'Unknown'} deleted`,
        timestamp: new Date()
      });
      // Update counts
      const totalChatMessages = await LiveChatMessage.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalChatMessages });
    }

    res.json({ message: 'Chat message deleted successfully.' });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete message.' });
  }
});

// DELETE /api/admin/confession/:id
router.delete('/confession/:id', requireAdmin, async (req, res) => {
  try {
    const confessionId = req.params.id;
    const confession = await Confession.findById(confessionId).populate('sender', 'displayName');
    if (!confession) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Confession not found.' });
    }

    await Confession.findByIdAndDelete(confessionId);
    
    // Resolve any reports associated with this target
    await Report.updateMany({ targetType: 'confession', targetId: confessionId }, { status: 'resolved' });

    // Log action
    await AdminLog.create({
      action: 'DELETE_CONFESSION',
      details: `Deleted confession by ${confession.sender?.displayName || 'Unknown'}: "${confession.text.substring(0, 50)}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('confession-deleted', confessionId);
      io.to('admin').emit('moderation-activity', {
        type: 'confession_deleted',
        text: `Confession #${confessionId.slice(-6)} deleted`,
        timestamp: new Date()
      });
      // Update counts
      const totalConfessions = await Confession.countDocuments();
      const totalReports = await Report.countDocuments({ status: 'pending' });
      io.to('admin').emit('admin-stats-update', { totalConfessions, totalReports });
    }

    res.json({ message: 'Confession deleted successfully.' });
  } catch (error) {
    console.error('Error deleting confession:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete confession.' });
  }
});

// DELETE /api/admin/meme/:id
router.delete('/meme/:id', requireAdmin, async (req, res) => {
  try {
    const memeId = req.params.id;
    const meme = await Meme.findById(memeId).populate('sender', 'displayName');
    if (!meme) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Meme not found.' });
    }

    const publicId = meme.publicId || meme.cloudinaryPublicId;
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryErr) {
        console.error('Failed to destroy Cloudinary asset:', cloudinaryErr);
      }
    }

    await Meme.findByIdAndDelete(memeId);
    await Report.updateMany({ targetType: 'meme', targetId: memeId }, { status: 'resolved' });

    // Log action
    await AdminLog.create({
      action: 'DELETE_MEME',
      details: `Deleted meme by ${meme.sender?.displayName || 'Unknown'} with caption: "${meme.caption || 'No caption'}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('meme-deleted', memeId);
      io.to('admin').emit('moderation-activity', {
        type: 'meme_deleted',
        text: `Meme #${memeId.slice(-6)} deleted`,
        timestamp: new Date()
      });
      // Update counts
      const totalMemes = await Meme.countDocuments();
      const totalReports = await Report.countDocuments({ status: 'pending' });
      io.to('admin').emit('admin-stats-update', { totalMemes, totalReports });
    }

    res.json({ message: 'Meme deleted successfully.' });
  } catch (error) {
    console.error('Error deleting meme:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete meme.' });
  }
});

// DELETE /api/admin/poll/:id
router.delete('/poll/:id', requireAdmin, async (req, res) => {
  try {
    const pollId = req.params.id;
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll not found.' });
    }

    await Poll.findByIdAndDelete(pollId);

    // Log action
    await AdminLog.create({
      action: 'DELETE_POLL',
      details: `Deleted poll: "${poll.question}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('poll-deleted', pollId);
      io.to('admin').emit('moderation-activity', {
        type: 'poll_deleted',
        text: `Poll #${pollId.slice(-6)} deleted`,
        timestamp: new Date()
      });
      const totalPolls = await Poll.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalPolls });
    }

    res.json({ message: 'Poll deleted successfully.' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete poll.' });
  }
});

// POST /api/admin/poll
// Allows admin to create a new poll
router.post('/poll', requireAdmin, async (req, res) => {
  try {
    const { question, options } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Question text is required.' });
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'At least two options are required.' });
    }

    // Resolve admin user ID (just use a mock sender or find the first user)
    let adminSender = await User.findOne({ displayName: 'administrator' });
    if (!adminSender) {
      adminSender = await User.findOne(); // Grab any user if none
    }

    const pollOptions = options.map(opt => ({ text: opt.trim(), votes: [] }));

    const poll = await Poll.create({
      question: question.trim(),
      options: pollOptions,
      sender: adminSender ? adminSender._id : null,
      campus: 'DSEU',
      isActive: true
    });

    const populatedPoll = await Poll.findById(poll._id).populate('sender', 'displayName');

    // Log action
    await AdminLog.create({
      action: 'CREATE_POLL',
      details: `Created poll: "${poll.question}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('new-poll', populatedPoll);
      io.to('admin').emit('moderation-activity', {
        type: 'poll_created',
        text: `New poll created: "${poll.question.substring(0, 40)}..."`,
        timestamp: new Date()
      });
      const totalPolls = await Poll.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalPolls });
    }

    res.status(201).json(populatedPoll);
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create poll.' });
  }
});

// POST /api/admin/user/:token/ban
// Ban/Unban user by browser token
router.post('/user/:token/ban', requireAdmin, async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ browserToken: token });

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found with this browser token.' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    const actionText = user.isBanned ? 'BAN_USER' : 'UNBAN_USER';
    const detailText = user.isBanned 
      ? `Banned user "${user.displayName}" (Token: ${token})` 
      : `Unbanned user "${user.displayName}" (Token: ${token})`;

    await AdminLog.create({
      action: actionText,
      details: detailText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: user.isBanned ? 'user_banned' : 'user_unbanned',
        text: detailText,
        timestamp: new Date()
      });
      
      // If banned, force client socket disconnect
      if (user.isBanned) {
        io.emit('user-banned-alert', token);
      }

      // Update counters
      const bannedUsers = await User.countDocuments({ isBanned: true });
      io.to('admin').emit('admin-stats-update', { bannedUsers });
    }

    res.json({ message: `User status updated. Banned: ${user.isBanned}`, isBanned: user.isBanned });
  } catch (error) {
    console.error('Error banning/unbanning user:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update user ban status.' });
  }
});

// POST /api/admin/user/:token/mute
router.post('/user/:token/mute', requireAdmin, async (req, res) => {
  try {
    const { token } = req.params;
    const { durationMinutes } = req.body; // default 60 mins

    const user = await User.findOne({ browserToken: token });
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const mins = parseInt(durationMinutes) || 60;
    const mutedUntil = new Date(Date.now() + mins * 60 * 1000);

    user.mutedUntil = mutedUntil;
    await user.save();

    const logText = `Muted user "${user.displayName}" for ${mins} minutes.`;
    await AdminLog.create({
      action: 'MUTE_USER',
      details: logText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: 'user_muted',
        text: logText,
        timestamp: new Date()
      });
      io.emit('user-muted-alert', { token, mutedUntil });
      
      const mutedUsers = await User.countDocuments({ mutedUntil: { $gt: new Date() } });
      io.to('admin').emit('admin-stats-update', { mutedUsers });
    }

    res.json({ message: `User muted for ${mins} minutes.`, mutedUntil });
  } catch (error) {
    console.error('Error muting user:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to mute user.' });
  }
});

// POST /api/admin/user/:token/unmute
router.post('/user/:token/unmute', requireAdmin, async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ browserToken: token });
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    user.mutedUntil = null;
    await user.save();

    const logText = `Unmuted user "${user.displayName}".`;
    await AdminLog.create({
      action: 'UNMUTE_USER',
      details: logText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: 'user_unmuted',
        text: logText,
        timestamp: new Date()
      });
      io.emit('user-unmuted-alert', token);

      const mutedUsers = await User.countDocuments({ mutedUntil: { $gt: new Date() } });
      io.to('admin').emit('admin-stats-update', { mutedUsers });
    }

    res.json({ message: 'User unmuted successfully.' });
  } catch (error) {
    console.error('Error unmuting user:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to unmute user.' });
  }
});

// POST /api/admin/slowmode
// Set slowmode seconds (0 to disable)
router.post('/slowmode', requireAdmin, async (req, res) => {
  try {
    const { seconds } = req.body;
    const slowmodeSeconds = parseInt(seconds) >= 0 ? parseInt(seconds) : 0;

    await Settings.findOneAndUpdate(
      { key: 'slow_mode_seconds' },
      { value: slowmodeSeconds },
      { upsert: true, new: true }
    );

    const logText = slowmodeSeconds > 0 
      ? `Enabled global chat slow mode (${slowmodeSeconds}s).` 
      : 'Disabled global chat slow mode.';

    await AdminLog.create({
      action: 'TOGGLE_SLOW_MODE',
      details: logText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('slow-mode-update', slowmodeSeconds);
      io.to('admin').emit('moderation-activity', {
        type: 'slowmode_changed',
        text: logText,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Slow mode setting updated.', slowmodeSeconds });
  } catch (error) {
    console.error('Error updating slow mode:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update slow mode.' });
  }
});

// POST /api/admin/announcement
// Pins a global campus announcement
router.post('/announcement', requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    const announcementText = (text && typeof text === 'string') ? text.trim() : '';

    await Settings.findOneAndUpdate(
      { key: 'pinned_announcement' },
      { value: announcementText },
      { upsert: true, new: true }
    );

    const logText = announcementText !== '' 
      ? `Updated pinned announcement: "${announcementText.substring(0, 50)}..."` 
      : 'Removed pinned announcement.';

    await AdminLog.create({
      action: 'PIN_ANNOUNCEMENT',
      details: logText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('announcement-update', announcementText);
      io.to('admin').emit('moderation-activity', {
        type: 'announcement_changed',
        text: logText,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Announcement updated successfully.', announcement: announcementText });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update announcement.' });
  }
});

// GET /api/admin/search/identities
// Search users by display name or token
router.get('/search/identities', requireAdmin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { displayName: { $regex: query, $options: 'i' } },
        { browserToken: { $regex: query, $options: 'i' } }
      ]
    }).limit(20);

    res.json(users);
  } catch (error) {
    console.error('Error searching identities:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to search identities.' });
  }
});

// GET /api/admin/search/content
// Search chat messages, confessions, and memes by keyword
router.get('/search/content', requireAdmin, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json({ messages: [], confessions: [], memes: [] });
    }

    const messages = await LiveChatMessage.find({ text: { $regex: query, $options: 'i' } })
      .populate('sender', 'displayName')
      .limit(20);

    const confessions = await Confession.find({ text: { $regex: query, $options: 'i' } })
      .populate('sender', 'displayName')
      .limit(20);

    const memes = await Meme.find({ caption: { $regex: query, $options: 'i' } })
      .populate('sender', 'displayName')
      .limit(20);

    res.json({ messages, confessions, memes });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to search content.' });
  }
});

// POST /api/admin/report/:id/resolve
router.post('/report/:id/resolve', requireAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Report not found.' });
    }

    report.status = 'resolved';
    await report.save();

    await AdminLog.create({
      action: 'RESOLVE_REPORT',
      details: `Resolved report #${reportId.slice(-6)}`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      const totalReports = await Report.countDocuments({ status: 'pending' });
      io.to('admin').emit('admin-stats-update', { totalReports });
      io.to('admin').emit('report-resolved', reportId);
    }

    res.json({ message: 'Report marked as resolved.' });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to resolve report.' });
  }
});

// POST /api/admin/maintenance - Toggle maintenance mode
router.post('/maintenance', requireAdmin, async (req, res) => {
  try {
    const { enabled, message } = req.body;
    const maintenanceEnabled = !!enabled;
    const maintenanceMsg = (message && typeof message === 'string') ? message.trim() : 'DSEU Unfiltered is currently undergoing scheduled maintenance. Please check back later!';

    await Settings.findOneAndUpdate(
      { key: 'maintenance_mode' },
      { value: maintenanceEnabled },
      { upsert: true }
    );

    await Settings.findOneAndUpdate(
      { key: 'maintenance_message' },
      { value: maintenanceMsg },
      { upsert: true }
    );

    const logText = maintenanceEnabled
      ? `Enabled Maintenance Mode with message: "${maintenanceMsg.substring(0, 50)}..."`
      : 'Disabled Maintenance Mode.';

    await AdminLog.create({
      action: 'TOGGLE_MAINTENANCE',
      details: logText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      // Emit event to public clients to trigger immediate maintenance screen
      io.emit('maintenance-mode-update', { enabled: maintenanceEnabled, message: maintenanceMsg });
      io.to('admin').emit('moderation-activity', {
        type: 'maintenance_changed',
        text: logText,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Maintenance mode updated successfully.', enabled: maintenanceEnabled, messageText: maintenanceMsg });
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update maintenance settings.' });
  }
});

// POST /api/admin/backup - Trigger manual database backup
router.post('/backup', requireAdmin, async (req, res) => {
  try {
    const backupResult = await runDatabaseBackup();

    if (backupResult.status === 'success') {
      await AdminLog.create({
        action: 'MANUAL_BACKUP',
        details: `Triggered manual database backup to ${backupResult.folder} (${backupResult.sizeKb} KB)`,
        adminUsername: req.admin.username
      });

      const io = getIo(req);
      if (io) {
        io.to('admin').emit('moderation-activity', {
          type: 'backup_completed',
          text: `Database backup completed successfully (${backupResult.sizeKb} KB)`,
          timestamp: new Date()
        });
      }

      res.json(backupResult);
    } else {
      res.status(500).json({ error: 'BACKUP_FAILED', message: backupResult.error || 'Failed to complete database backup.' });
    }
  } catch (error) {
    console.error('Error triggering manual backup:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Backup execution error.' });
  }
});

// GET /api/admin/backup/status - Fetch last backup metadata status
router.get('/backup/status', requireAdmin, async (req, res) => {
  try {
    const statusSetting = await Settings.findOne({ key: 'last_backup_status' });
    res.json(statusSetting ? statusSetting.value : { status: 'none', timestamp: null });
  } catch (error) {
    console.error('Error fetching backup status:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch backup status metadata.' });
  }
});

const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// GET /api/admin/users - Paginated user management table
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const filter = req.query.filter || 'all';
    const sort = req.query.sort || 'newest';

    const activeUsers = req.app.get('activeUsers') || new Map();
    const onlineTokens = Array.from(activeUsers.values()).map(u => u.browserToken);

    // Build pipeline
    const pipeline = [];

    // Match conditions
    const match = {};
    if (search) {
      const orConditions = [
        { displayName: { $regex: search, $options: 'i' } },
        { browserToken: { $regex: search, $options: 'i' } }
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: new mongoose.Types.ObjectId(search) });
      }
      match.$or = orConditions;
    }

    if (filter === 'online') {
      match.browserToken = { $in: onlineTokens };
    } else if (filter === 'offline') {
      match.browserToken = { $nin: onlineTokens };
    } else if (filter === 'muted') {
      match.mutedUntil = { $gt: new Date() };
    } else if (filter === 'banned') {
      match.isBanned = true;
    } else if (filter === 'reported') {
      const reportedTokens = await Report.distinct('reporterToken');
      match.browserToken = { $in: reportedTokens };
    }

    pipeline.push({ $match: match });

    // Lookups for counts
    pipeline.push(
      {
        $lookup: {
          from: 'livechatmessages',
          localField: '_id',
          foreignField: 'sender',
          as: 'chats'
        }
      },
      {
        $lookup: {
          from: 'confessions',
          localField: '_id',
          foreignField: 'sender',
          as: 'confessions'
        }
      },
      {
        $lookup: {
          from: 'memes',
          localField: '_id',
          foreignField: 'sender',
          as: 'memes'
        }
      }
    );

    // Project counts
    pipeline.push({
      $project: {
        displayName: 1,
        browserToken: 1,
        campus: 1,
        isBanned: 1,
        mutedUntil: 1,
        lastActive: 1,
        createdAt: 1,
        updatedAt: 1,
        chatCount: { $size: '$chats' },
        confessionCount: { $size: '$confessions' },
        memeCount: { $size: '$memes' }
      }
    });

    // Add activity sum
    pipeline.push({
      $addFields: {
        totalActivity: { $add: ['$chatCount', '$confessionCount', '$memeCount'] }
      }
    });

    // Sort
    if (sort === 'newest') {
      pipeline.push({ $sort: { createdAt: -1 } });
    } else if (sort === 'oldest') {
      pipeline.push({ $sort: { createdAt: 1 } });
    } else if (sort === 'most_active') {
      pipeline.push({ $sort: { totalActivity: -1, lastActive: -1 } });
    } else if (sort === 'least_active') {
      pipeline.push({ $sort: { totalActivity: 1, lastActive: 1 } });
    } else {
      pipeline.push({ $sort: { lastActive: -1 } });
    }

    // Get total count for pagination
    const allMatching = await User.aggregate([{ $match: match }, { $count: 'count' }]);
    const totalUsers = allMatching.length > 0 ? allMatching[0].count : 0;
    const totalPages = Math.ceil(totalUsers / limit);

    // Apply pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const paginatedUsers = await User.aggregate(pipeline);

    // Fetch Poll and Report counts and online status for each user
    const usersWithDetails = await Promise.all(paginatedUsers.map(async (u) => {
      const pollCount = await Poll.countDocuments({ "options.votes": u.browserToken });
      const reportCount = await Report.countDocuments({ reporterToken: u.browserToken });
      return {
        ...u,
        pollCount,
        reportCount,
        isOnline: onlineTokens.includes(u.browserToken)
      };
    }));

    res.json({
      users: usersWithDetails,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch users list.' });
  }
});

// GET /api/admin/user/:id/profile - Fetch a user's full activity history
router.get('/user/:id/profile', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const activeUsers = req.app.get('activeUsers') || new Map();
    const isOnline = Array.from(activeUsers.values()).some(u => u.browserToken === user.browserToken);

    // Fetch all user messages, confessions, memes, polls, and reports
    const chats = await LiveChatMessage.find({ sender: id }).sort({ createdAt: -1 });
    const confessions = await Confession.find({ sender: id }).sort({ createdAt: -1 });
    const memes = await Meme.find({ sender: id }).sort({ createdAt: -1 });
    
    // Voted polls
    const polls = await Poll.find({ "options.votes": user.browserToken }).sort({ createdAt: -1 });
    
    // Reports submitted by them
    const reports = await Report.find({ reporterToken: user.browserToken }).sort({ createdAt: -1 });

    // Fetch ban/mute history logs
    const logs = await AdminLog.find({
      details: { $regex: user.displayName, $options: 'i' }
    }).sort({ createdAt: -1 });

    res.json({
      profile: {
        _id: user._id,
        displayName: user.displayName,
        browserToken: user.browserToken,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        isBanned: user.isBanned,
        mutedUntil: user.mutedUntil,
        isOnline
      },
      chats,
      confessions,
      memes,
      polls,
      reports,
      logs
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch user profile.' });
  }
});

// POST /api/admin/user/:id/reset-identity - Regenerate anonymous nickname
router.post('/user/:id/reset-identity', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const oldName = user.displayName;
    const newName = await generateUniqueIdentity();
    user.displayName = newName;
    await user.save();

    const logMsg = `Reset identity of user "${oldName}" to "${newName}" (ID: ${user._id})`;
    await AdminLog.create({
      action: 'RESET_IDENTITY',
      details: logMsg,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: 'identity_reset',
        text: logMsg,
        timestamp: new Date()
      });
      // Emit event to update client lists in real time
      io.emit('user-identity-reset', { userId: user._id, oldName, newName });
    }

    res.json({ message: 'Anonymous identity reset successfully.', newDisplayName: newName });
  } catch (error) {
    console.error('Error resetting user identity:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reset user identity.' });
  }
});

// POST /api/admin/user/bulk-action - Perform batch ban/mute/delete/reset operations
router.post('/user/bulk-action', requireAdmin, async (req, res) => {
  try {
    const { userIds, action, durationMinutes } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'User IDs array is required.' });
    }

    const io = getIo(req);
    const results = { updated: 0, failed: 0 };

    for (const id of userIds) {
      try {
        const user = await User.findById(id);
        if (!user) {
          results.failed++;
          continue;
        }

        if (action === 'ban') {
          user.isBanned = true;
          await user.save();
          if (io) {
            io.emit('user-banned-alert', user.browserToken);
          }
        } else if (action === 'unban') {
          user.isBanned = false;
          await user.save();
        } else if (action === 'mute') {
          const mins = parseInt(durationMinutes) || 60;
          const mutedUntil = new Date(Date.now() + mins * 60 * 1000);
          user.mutedUntil = mutedUntil;
          await user.save();
          if (io) {
            io.emit('user-muted-alert', { token: user.browserToken, mutedUntil });
          }
        } else if (action === 'unmute') {
          user.mutedUntil = null;
          await user.save();
        } else if (action === 'reset-identity') {
          user.displayName = await generateUniqueIdentity();
          await user.save();
        } else if (action === 'delete') {
          // Delete all memes from Cloudinary
          const userMemes = await Meme.find({ sender: id });
          for (const meme of userMemes) {
            const pId = meme.publicId || meme.cloudinaryPublicId;
            if (pId && isCloudinaryConfigured()) {
              try {
                await cloudinary.uploader.destroy(pId);
              } catch (err) {
                console.error('Error destroying Cloudinary asset during bulk delete:', err);
              }
            }
          }
          // Delete all database records for this user
          await Meme.deleteMany({ sender: id });
          await Confession.deleteMany({ sender: id });
          await LiveChatMessage.deleteMany({ sender: id });
          await User.deleteOne({ _id: id });
        } else if (action === 'delete-messages') {
          await LiveChatMessage.deleteMany({ sender: id });
        } else if (action === 'delete-memes') {
          const userMemes = await Meme.find({ sender: id });
          for (const meme of userMemes) {
            const pId = meme.publicId || meme.cloudinaryPublicId;
            if (pId && isCloudinaryConfigured()) {
              try {
                await cloudinary.uploader.destroy(pId);
              } catch (err) {
                console.error('Error destroying Cloudinary asset:', err);
              }
            }
          }
          await Meme.deleteMany({ sender: id });
        } else if (action === 'delete-confessions') {
          await Confession.deleteMany({ sender: id });
        } else if (action === 'delete-polls') {
          await Poll.deleteMany({ sender: id });
        }

        results.updated++;
      } catch (err) {
        console.error(`Error processing bulk user action for ID ${id}:`, err);
        results.failed++;
      }
    }

    // Log bulk action
    const logDetails = `Executed bulk action "${action}" on ${results.updated} users (Failed: ${results.failed})`;
    await AdminLog.create({
      action: `BULK_${action.toUpperCase()}`,
      details: logDetails,
      adminUsername: req.admin.username
    });

    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: `bulk_${action}`,
        text: logDetails,
        timestamp: new Date()
      });
      // Emit trigger to refresh lists
      io.emit('bulk-moderation-update');
    }

    res.json({ message: 'Bulk action completed.', results });
  } catch (error) {
    console.error('Error executing bulk user action:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process bulk actions.' });
  }
});

// POST /api/admin/content/bulk-delete - Delete multiple posts or reports at once
router.post('/content/bulk-delete', requireAdmin, async (req, res) => {
  try {
    const { targetIds, targetType } = req.body;
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Target IDs array is required.' });
    }

    const io = getIo(req);
    let deletedCount = 0;

    if (targetType === 'meme') {
      const memes = await Meme.find({ _id: { $in: targetIds } });
      for (const m of memes) {
        const pId = m.publicId || m.cloudinaryPublicId;
        if (pId && isCloudinaryConfigured()) {
          try {
            await cloudinary.uploader.destroy(pId);
          } catch (err) {
            console.error('Error destroying Cloudinary asset:', err);
          }
        }
      }
      const result = await Meme.deleteMany({ _id: { $in: targetIds } });
      deletedCount = result.deletedCount;
      if (io) {
        targetIds.forEach(id => io.emit('meme-deleted', id));
      }
    } else if (targetType === 'confession') {
      const result = await Confession.deleteMany({ _id: { $in: targetIds } });
      deletedCount = result.deletedCount;
      if (io) {
        targetIds.forEach(id => io.emit('confession-deleted', id));
      }
    } else if (targetType === 'report') {
      const result = await Report.deleteMany({ _id: { $in: targetIds } });
      deletedCount = result.deletedCount;
    } else if (targetType === 'message') {
      const result = await LiveChatMessage.deleteMany({ _id: { $in: targetIds } });
      deletedCount = result.deletedCount;
      if (io) {
        targetIds.forEach(id => io.emit('chat-message-deleted', id));
      }
    }

    const logDetails = `Bulk deleted ${deletedCount} ${targetType}s`;
    await AdminLog.create({
      action: `BULK_DELETE_${targetType.toUpperCase()}`,
      details: logDetails,
      adminUsername: req.admin.username
    });

    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: `bulk_delete_${targetType}`,
        text: logDetails,
        timestamp: new Date()
      });
    }

    res.json({ message: `${deletedCount} items deleted successfully.` });
  } catch (error) {
    console.error('Error in bulk content delete:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to bulk delete content.' });
  }
});

// GET /api/admin/reports - Fetch all reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch reports list.' });
  }
});

// POST /api/admin/report/:id/action - Act on a specific content report
router.post('/report/:id/action', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, durationMinutes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Report not found.' });
    }

    const io = getIo(req);
    let logDetail = '';

    if (action === 'delete_content') {
      // Delete the reported content item
      if (report.targetType === 'message') {
        await LiveChatMessage.deleteOne({ _id: report.targetId });
        if (io) io.emit('chat-message-deleted', report.targetId);
      } else if (report.targetType === 'confession') {
        await Confession.deleteOne({ _id: report.targetId });
        if (io) io.emit('confession-deleted', report.targetId);
      } else if (report.targetType === 'meme') {
        const meme = await Meme.findById(report.targetId);
        if (meme) {
          const pId = meme.publicId || meme.cloudinaryPublicId;
          if (pId && isCloudinaryConfigured()) {
            try {
              await cloudinary.uploader.destroy(pId);
            } catch (err) {
              console.error('Error deleting Cloudinary asset from report action:', err);
            }
          }
          await Meme.deleteOne({ _id: report.targetId });
        }
        if (io) io.emit('meme-deleted', report.targetId);
      }
      report.status = 'resolved';
      await report.save();
      logDetail = `Deleted reported ${report.targetType} (ID: ${report.targetId}) and resolved report ${id}`;
    } else if (action === 'ignore') {
      report.status = 'resolved';
      await report.save();
      logDetail = `Ignored report ${id} for ${report.targetType} (ID: ${report.targetId})`;
    } else if (action === 'ban_user') {
      // Find target user by reporter/target content
      let targetUserToken = '';
      if (report.targetType === 'message') {
        const msg = await LiveChatMessage.findById(report.targetId);
        if (msg) {
          const usr = await User.findById(msg.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      } else if (report.targetType === 'confession') {
        const conf = await Confession.findById(report.targetId);
        if (conf) {
          const usr = await User.findById(conf.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      } else if (report.targetType === 'meme') {
        const meme = await Meme.findById(report.targetId);
        if (meme) {
          const usr = await User.findById(meme.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      }

      if (targetUserToken) {
        const userObj = await User.findOne({ browserToken: targetUserToken });
        if (userObj) {
          userObj.isBanned = true;
          await userObj.save();
          if (io) {
            io.emit('user-banned-alert', targetUserToken);
          }
          logDetail = `Banned creator of reported content (DisplayName: ${userObj.displayName}) and resolved report ${id}`;
        }
      }
      report.status = 'resolved';
      await report.save();
    } else if (action === 'mute_user') {
      let targetUserToken = '';
      if (report.targetType === 'message') {
        const msg = await LiveChatMessage.findById(report.targetId);
        if (msg) {
          const usr = await User.findById(msg.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      } else if (report.targetType === 'confession') {
        const conf = await Confession.findById(report.targetId);
        if (conf) {
          const usr = await User.findById(conf.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      } else if (report.targetType === 'meme') {
        const meme = await Meme.findById(report.targetId);
        if (meme) {
          const usr = await User.findById(meme.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      }

      if (targetUserToken) {
        const userObj = await User.findOne({ browserToken: targetUserToken });
        if (userObj) {
          const mins = parseInt(durationMinutes) || 60;
          const mutedUntil = new Date(Date.now() + mins * 60 * 1000);
          userObj.mutedUntil = mutedUntil;
          await userObj.save();
          if (io) {
            io.emit('user-muted-alert', { token: targetUserToken, mutedUntil });
          }
          logDetail = `Muted creator of reported content for ${mins}m (DisplayName: ${userObj.displayName}) and resolved report ${id}`;
        }
      }
      report.status = 'resolved';
      await report.save();
    }

    if (logDetail) {
      await AdminLog.create({
        action: 'RESOLVE_REPORT',
        details: logDetail,
        adminUsername: req.admin.username
      });

      if (io) {
        io.to('admin').emit('moderation-activity', {
          type: 'resolve_report',
          text: logDetail,
          timestamp: new Date()
        });
      }
    }

    res.json({ message: 'Report action completed successfully.', report });
  } catch (error) {
    console.error('Error acting on report:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to act on report.' });
  }
});

export default router;
