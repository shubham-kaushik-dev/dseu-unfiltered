import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import xlsx from 'xlsx';
import { 
  requireAdmin, 
  requireSuperAdmin,
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
import AdminLog from '../models/AdminLog.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Settings from '../models/Settings.js';
import PinnedMessage from '../models/PinnedMessage.js';
import SupportMessage from '../models/SupportMessage.js';
import AdminNotification from '../models/AdminNotification.js';
import AdminSession from '../models/AdminSession.js';
import Announcement from '../models/Announcement.js';
import { runDatabaseBackup } from '../utils/backup.js';
import { generateUniqueIdentity } from '../utils/identity.js';

const router = express.Router();
const getIo = (req) => req.app.get('io');

const getAdminSenderName = (req) => {
  if (req && req.admin && req.admin.username === 'berlin') {
    return 'Berlin (SUB ADMIN)';
  }
  return 'Professor (ADMIN)';
};

const sendSystemSupportMessage = async (browserToken, text, req) => {
  try {
    const senderName = getAdminSenderName(req);
    await SupportMessage.create({
      browserToken,
      senderType: 'admin',
      senderName,
      text,
      isSeen: false
    });
    const io = getIo(req);
    if (io) {
      io.to(`support-${browserToken}`).emit('support-message', {
        browserToken,
        senderType: 'admin',
        senderName,
        text,
        createdAt: new Date()
      });
    }
  } catch (err) {
    console.error('Failed to send system support message:', err);
  }
};

const getOnlineCount = async (req) => {
  const io = getIo(req);
  if (!io) return 0;
  let count = io.sockets.sockets.size;
  try {
    const stealthSetting = await Settings.findOne({ key: 'stealth_mode' });
    const isStealth = stealthSetting ? stealthSetting.value : false;

    if (isStealth) {
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser) {
        const activeUsers = req.app.get('activeUsers') || new Map();
        const activeSocks = Array.from(activeUsers.values());
        const hasAdmin = activeSocks.some(u => u.browserToken === adminUser.browserToken);
        if (hasAdmin) {
          count = Math.max(0, count - 1);
        }
      }
    }
  } catch (err) {
    console.error('Error calculating online count in admin:', err);
  }
  return count;
};

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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

let hashedAdminPassword = '';
let hashedSubAdminPassword = '';
const adminUsername = process.env.ADMIN_USERNAME || 'Kaushik';
const adminPasswordRaw = process.env.ADMIN_PASSWORD || 'Ananya2608';

const initAdminPassword = async () => {
  hashedAdminPassword = await bcrypt.hash(adminPasswordRaw, 10);
  hashedSubAdminPassword = await bcrypt.hash('Kaushik2608', 10);
};
initAdminPassword();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { username, password } = req.body;

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

  const isSuperAdmin = username === 'Professor' || username === adminUsername;
  const isSubAdmin = username === 'berlin';
  const usernameMatch = isSuperAdmin || isSubAdmin;
  let passwordMatch = false;

  if (isSuperAdmin) {
    passwordMatch = await bcrypt.compare(password, hashedAdminPassword);
  } else if (isSubAdmin) {
    passwordMatch = await bcrypt.compare(password, hashedSubAdminPassword);
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

  clearFailedAttempts(ip);

  const role = isSuperAdmin ? 'super_admin' : 'sub_admin';

  // 1. Log session in MongoDB
  const session = await AdminSession.create({
    adminUsername: username,
    loginTime: new Date(),
    browser: req.headers['user-agent'] || '',
    ip: ip
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign(
    { username, role, csrfToken, sessionId: session._id },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  // Removed res.cookie call to support token-based JWT bearer authentication instead of cookie sessions

  await AdminLog.create({
    action: 'ADMIN_LOGIN',
    details: `Admin (${role}) logged in from IP ${ip}`,
    adminUsername: username
  });

  const io = getIo(req);
  if (io) {
    io.to('admin').emit('moderation-activity', {
      type: 'admin_login',
      text: `Admin (${username}) logged in from IP ${ip}`,
      timestamp: new Date()
    });
    // Trigger stealth update
    io.emit('online-stealth-update');
  }

  res.json({ message: 'Logged in successfully as administrator.', token, csrfToken, role });
});

// POST /api/admin/logout
router.post('/logout', async (req, res) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      if (decoded.sessionId) {
        const session = await AdminSession.findById(decoded.sessionId);
        if (session) {
          session.logoutTime = new Date();
          session.durationSeconds = Math.ceil((session.logoutTime - session.loginTime) / 1000);
          await session.save();
        }
      }
    } catch (err) {
      // ignore token verification failures
    }
  }

  // Trigger online stealth update
  const io = getIo(req);
  if (io) {
    io.emit('online-stealth-update');
  }

  res.json({ message: 'Logged out successfully.' });
});

// GET /api/admin/check
router.get('/check', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, role: req.admin.role, csrfToken: req.admin.csrfToken });
});

// GET /api/admin/notifications/unread-counts
router.get('/notifications/unread-counts', requireAdmin, async (req, res) => {
  try {
    const support = await AdminNotification.countDocuments({ type: 'support_request', isRead: false });
    const resets = await AdminNotification.countDocuments({ type: 'reset_request', isRead: false });
    const users = await AdminNotification.countDocuments({ type: 'new_user', isRead: false });
    const reports = await AdminNotification.countDocuments({ type: 'new_report', isRead: false });
    res.json({ support, resets, users, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to count unread notifications.' });
  }
});

// POST /api/admin/notifications/mark-read
router.post('/notifications/mark-read', requireAdmin, async (req, res) => {
  try {
    const { section } = req.body;
    let type = '';
    if (section === 'support') type = 'support_request';
    else if (section === 'resets') type = 'reset_request';
    else if (section === 'users') type = 'new_user';
    else if (section === 'reports') type = 'new_report';
    else {
      return res.status(400).json({ message: 'Invalid section.' });
    }

    await AdminNotification.updateMany({ type, isRead: false }, { isRead: true });

    // Emit update so other admin sessions sync
    const io = getIo(req);
    if (io) {
      io.to('admin').emit('admin-notifications-updated');
    }

    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to mark notifications as read.' });
  }
});

// GET /api/admin/stats - Live counters and status indicators
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalChatMessages = await LiveChatMessage.countDocuments({ status: { $ne: 'trash' } });
    const totalConfessions = await Confession.countDocuments({ status: { $ne: 'trash' } });
    const totalMemes = await Meme.countDocuments({ status: { $ne: 'trash' } });
    const totalPolls = await Poll.countDocuments({ status: { $ne: 'trash' } });
    const totalReports = await Report.countDocuments();
    const totalReportsPending = await Report.countDocuments({ status: 'pending' });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const mutedUsers = await User.countDocuments({ mutedUntil: { $gt: new Date() } });

    // Today's boundaries
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const newUsersToday = await User.countDocuments({ createdAt: { $gte: startOfToday }, role: { $ne: 'admin' } });
    const chatMessagesToday = await LiveChatMessage.countDocuments({ createdAt: { $gte: startOfToday }, status: { $ne: 'trash' } });
    const confessionsToday = await Confession.countDocuments({ createdAt: { $gte: startOfToday }, status: { $ne: 'trash' } });
    const memesToday = await Meme.countDocuments({ createdAt: { $gte: startOfToday }, status: { $ne: 'trash' } });
    const pollsToday = await Poll.countDocuments({ createdAt: { $gte: startOfToday }, status: { $ne: 'trash' } });
    const reportsToday = await Report.countDocuments({ createdAt: { $gte: startOfToday } });
    const todayActiveUsers = await User.countDocuments({ lastActive: { $gte: startOfToday } });

    // Sockets status
    const io = getIo(req);
    const onlineUsers = io ? io.sockets.sockets.size : 0;
    const offlineUsers = Math.max(0, totalUsers - onlineUsers);

    // Systems details
    const dbStatus = mongoose.connection.readyState === 1 ? 'Operational' : 'Error';
    const cloudinaryStatus = isCloudinaryConfigured() ? 'Configured' : 'Not Configured';
    const socketStatus = io ? 'Active' : 'Offline';

    res.json({
      totalUsers,
      onlineUsers,
      offlineUsers,
      totalChatMessages,
      totalConfessions,
      totalMemes,
      totalPolls,
      totalReports,
      totalReportsPending,
      bannedUsers,
      mutedUsers,
      todayActiveUsers,
      today: {
        newUsers: newUsersToday,
        chatMessages: chatMessagesToday,
        confessions: confessionsToday,
        memes: memesToday,
        polls: pollsToday,
        reports: reportsToday
      },
      systems: {
        db: dbStatus,
        cloudinary: cloudinaryStatus,
        sockets: socketStatus,
        server: 'Operational'
      }
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve stats.' });
  }
});

// GET /api/admin/reports - Fetch all pending reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const list = await Report.find({ status: 'pending' }).sort({ createdAt: -1 });
    
    // Enrich reports with details
    const enrichedList = await Promise.all(list.map(async (r) => {
      let targetDetails = '';
      if (r.targetType === 'message') {
        const msg = await LiveChatMessage.findById(r.targetId);
        targetDetails = msg ? msg.text : '[Message Deleted]';
      } else if (r.targetType === 'confession') {
        const conf = await Confession.findById(r.targetId);
        targetDetails = conf ? conf.text : '[Confession Deleted]';
      } else if (r.targetType === 'meme') {
        const meme = await Meme.findById(r.targetId);
        targetDetails = meme ? `Meme attachment: ${meme.imageUrl} | Caption: ${meme.caption || 'None'}` : '[Meme Deleted]';
      } else if (r.targetType === 'poll') {
        const poll = await Poll.findById(r.targetId);
        targetDetails = poll ? `Poll Question: ${poll.question}` : '[Poll Deleted]';
      }

      return {
        ...r.toObject(),
        targetDetails
      };
    }));

    res.json(enrichedList);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch reports list.' });
  }
});

// GET /api/admin/logs - Fetch audit logs
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const list = await AdminLog.find({}).sort({ createdAt: -1 }).limit(200);
    res.json(list);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch audit logs.' });
  }
});

// POST /api/admin/settings - Save site configurations
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const key of Object.keys(updates)) {
      await Settings.findOneAndUpdate(
        { key },
        { value: updates[key] },
        { upsert: true, new: true }
      );
    }

    const io = getIo(req);
    if (io) {
      io.emit('settings-updated');
      io.emit('online-stealth-update'); // In case stealth mode was toggled
    }

    res.json({ message: 'Settings saved successfully.' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save settings.' });
  }
});

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

    const match = { role: { $ne: 'admin' } };
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

    const sortOption = {};
    if (sort === 'newest') sortOption.createdAt = -1;
    else if (sort === 'oldest') sortOption.createdAt = 1;
    else if (sort === 'most_active') sortOption.lastActive = -1;
    else sortOption.lastActive = -1;

    const totalUsers = await User.countDocuments(match);
    const totalPages = Math.ceil(totalUsers / limit);

    const list = await User.find(match)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    const usersWithCounts = await Promise.all(list.map(async (u) => {
      const chatCount = await LiveChatMessage.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const confessionCount = await Confession.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const memeCount = await Meme.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const pollCount = await Poll.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const reportCount = await Report.countDocuments({ reporterToken: u.browserToken });

      const uObj = u.toObject();
      if (req.admin.role === 'sub_admin') {
        uObj.realName = '[REDACTED]';
        uObj.campus = '[REDACTED]';
      }

      return {
        ...uObj,
        chatCount,
        confessionCount,
        memeCount,
        pollCount,
        reportCount,
        isOnline: onlineTokens.includes(u.browserToken)
      };
    }));

    res.json({
      users: usersWithCounts,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load users.' });
  }
});

// GET /api/admin/user/:id/profile - User Profile overview details
router.get('/user/:id/profile', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userObj = await User.findById(id);
    if (!userObj) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    // Restriction check: sub_admin can only view profile if the user is banned
    if (req.admin.role === 'sub_admin' && !userObj.isBanned) {
      return res.status(403).json({ error: 'ADMIN_FORBIDDEN', message: 'ACCESS DENIED. Super Admin privileges required.' });
    }

    const chats = await LiveChatMessage.find({ sender: id, status: { $ne: 'trash' } }).sort({ createdAt: -1 });
    const confessions = await Confession.find({ sender: id, status: { $ne: 'trash' } }).sort({ createdAt: -1 });
    const memes = await Meme.find({ sender: id, status: { $ne: 'trash' } }).sort({ createdAt: -1 });
    const polls = await Poll.find({ sender: id, status: { $ne: 'trash' } }).sort({ createdAt: -1 });
    const reports = await Report.find({ reporterToken: userObj.browserToken }).sort({ createdAt: -1 });
    const logs = await AdminLog.find({ details: { $regex: userObj.displayName, $options: 'i' } }).sort({ createdAt: -1 });

    const profileObj = userObj.toObject();
    if (req.admin.role === 'sub_admin') {
      profileObj.realName = '[REDACTED]';
      profileObj.campus = '[REDACTED]';
    }

    res.json({
      profile: profileObj,
      chats,
      confessions,
      memes,
      polls,
      reports,
      logs
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch profile.' });
  }
});

// POST /api/admin/user/:id/warn - Add warning to user
router.post('/user/:id/warn', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Warning reason is required.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    user.warnings.push({ reason: reason.trim() });
    await user.save();

    const detailText = `Warned user "${user.displayName}" (Warning #${user.warnings.length}): "${reason}"`;
    await AdminLog.create({
      action: 'WARN_USER',
      details: detailText,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: 'user_warned',
        text: detailText,
        timestamp: new Date()
      });
      // Emit warning to target user socket connection
      io.emit('user-warned', { browserToken: user.browserToken, reason: reason.trim(), warningsCount: user.warnings.length });
    }

    res.json({ message: 'Warning added successfully.', warnings: user.warnings });
  } catch (error) {
    console.error('Error warning user:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to warn user.' });
  }
});

// POST /api/admin/user/:id/unwarn - Remove warning
router.post('/user/:id/unwarn', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { warningId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    user.warnings = user.warnings.filter(w => w._id.toString() !== warningId);
    await user.save();

    await AdminLog.create({
      action: 'REMOVE_WARNING',
      details: `Removed warning #${warningId} from user "${user.displayName}"`,
      adminUsername: req.admin.username
    });

    res.json({ message: 'Warning removed successfully.', warnings: user.warnings });
  } catch (error) {
    console.error('Error removing warning:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to remove warning.' });
  }
});

// POST /api/admin/user/:id/notes - Save admin private notes
router.post('/user/:id/notes', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    user.adminNotes = notes || '';
    await user.save();

    res.json({ message: 'Admin notes saved.', notes: user.adminNotes });
  } catch (error) {
    console.error('Error updating admin notes:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update notes.' });
  }
});

// POST /api/admin/user/:id/reset-identity
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
      io.emit('user-identity-reset', { userId: user._id, oldName, newName });
    }

    res.json({ message: 'Anonymous identity reset successfully.', newDisplayName: newName });
  } catch (error) {
    console.error('Error resetting user identity:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reset user identity.' });
  }
});

// POST /api/admin/user/bulk-action - Batch actions
router.post('/user/bulk-action', requireAdmin, async (req, res) => {
  try {
    const { userIds, action, durationMinutes, banReason } = req.body;
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
          user.banReason = banReason || 'Violated community guidelines';
          user.bannedBy = 'Professor';
          user.banDate = new Date();
          await user.save();

          const reasonText = banReason || 'Violated community guidelines';
          const banMsg = `🚫 Your account has been banned.\n\nReason:\n${reasonText}\n\nIf you believe this is a mistake, you can reply here to appeal your ban.`;
          await sendSystemSupportMessage(user.browserToken, banMsg, req);

          if (io) {
            io.emit('user-banned-alert', user.browserToken);
            io.to('admin').emit('user-ban-status-updated', { userId: user._id, isBanned: true });
          }
        } else if (action === 'unban') {
          user.isBanned = false;
          user.banReason = '';
          user.bannedBy = '';
          user.banDate = null;
          await user.save();

          const unbanMsg = `✅ Your account has been unbanned.\n\nWelcome back.\n\nAll your account data, chats, confessions, memes and activity have been restored.\n\nPlease continue following community rules.`;
          await sendSystemSupportMessage(user.browserToken, unbanMsg, req);

          if (io) {
            io.emit('user-unbanned-alert', user.browserToken);
            io.to('admin').emit('user-ban-status-updated', { userId: user._id, isBanned: false });
          }
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
        } else if (action === 'shadow-ban') {
          user.isShadowBanned = true;
          await user.save();
        } else if (action === 'unshadow-ban') {
          user.isShadowBanned = false;
          await user.save();
        } else if (action === 'delete') {
          // Soft-delete user posts
          await LiveChatMessage.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
          await Confession.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
          await Meme.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
          await Poll.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
          await User.deleteOne({ _id: id });
        } else if (action === 'delete-messages') {
          await LiveChatMessage.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
        } else if (action === 'delete-memes') {
          await Meme.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
        } else if (action === 'delete-confessions') {
          await Confession.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
        } else if (action === 'delete-polls') {
          await Poll.updateMany({ sender: id }, { status: 'trash', deletedAt: new Date() });
        }

        results.updated++;
      } catch (err) {
        results.failed++;
      }
    }

    if (io) {
      io.emit('bulk-moderation-update');
      io.emit('online-stealth-update');
    }

    res.json({ message: 'Bulk actions processed successfully.', results });
  } catch (error) {
    console.error('Error performing bulk actions:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process bulk actions.' });
  }
});

// POST /api/admin/users/:id/:action - Ban or Unban a specific user
router.post('/users/:id/:action', requireAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;
    const { banReason } = req.body || {};

    if (action !== 'ban' && action !== 'unban') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid action parameter.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const io = getIo(req);

    if (action === 'ban') {
      user.isBanned = true;
      user.banReason = banReason || 'Violated community guidelines';
      user.bannedBy = 'Professor';
      user.banDate = new Date();
      await user.save();

      const reasonText = banReason || 'Violated community guidelines';
      const banMsg = `🚫 Your account has been banned.\n\nReason:\n${reasonText}\n\nIf you believe this is a mistake, you can reply here to appeal your ban.`;
      await sendSystemSupportMessage(user.browserToken, banMsg, req);

      if (io) {
        io.emit('user-banned-alert', user.browserToken);
        io.emit('online-stealth-update');
        io.emit('online-count', await getOnlineCount(req));
        io.to('admin').emit('user-ban-status-updated', { userId: user._id, isBanned: true });
      }
    } else if (action === 'unban') {
      user.isBanned = false;
      user.banReason = '';
      user.bannedBy = '';
      user.banDate = null;
      await user.save();

      const unbanMsg = `✅ Your account has been unbanned.\n\nWelcome back.\n\nAll your account data, chats, confessions, memes and activity have been restored.\n\nPlease continue following community rules.`;
      await sendSystemSupportMessage(user.browserToken, unbanMsg, req);

      if (io) {
        io.emit('user-unbanned-alert', user.browserToken);
        io.emit('online-stealth-update');
        io.emit('online-count', await getOnlineCount(req));
        io.to('admin').emit('user-ban-status-updated', { userId: user._id, isBanned: false });
      }
    }

    res.json({ message: `User successfully ${action === 'ban' ? 'banned' : 'unbanned'}.`, user });
  } catch (error) {
    console.error('Error updating ban status:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update ban status.' });
  }
});

// Soft Delete (Trash Bin) Endpoints

// GET /api/admin/trash - Get all items marked as trash
router.get('/trash', requireAdmin, async (req, res) => {
  try {
    const messages = await LiveChatMessage.find({ status: 'trash' }).populate('sender', 'displayName');
    const confessions = await Confession.find({ status: 'trash' }).populate('sender', 'displayName');
    const memes = await Meme.find({ status: 'trash' }).populate('sender', 'displayName');
    const polls = await Poll.find({ status: 'trash' }).populate('sender', 'displayName');

    res.json({
      messages,
      confessions,
      memes,
      polls
    });
  } catch (error) {
    console.error('Error fetching trash list:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch trash items.' });
  }
});

// POST /api/admin/trash/restore - Restore soft-deleted content
router.post('/trash/restore', requireAdmin, async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    let restoredItem = null;

    if (targetType === 'message') {
      restoredItem = await LiveChatMessage.findByIdAndUpdate(targetId, { status: 'active', deletedAt: null }, { new: true });
    } else if (targetType === 'confession') {
      restoredItem = await Confession.findByIdAndUpdate(targetId, { status: 'active', deletedAt: null }, { new: true });
    } else if (targetType === 'meme') {
      restoredItem = await Meme.findByIdAndUpdate(targetId, { status: 'active', deletedAt: null }, { new: true });
    } else if (targetType === 'poll') {
      restoredItem = await Poll.findByIdAndUpdate(targetId, { status: 'active', deletedAt: null }, { new: true });
    }

    if (!restoredItem) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found.' });
    }

    await AdminLog.create({
      action: 'RESTORE_CONTENT',
      details: `Restored ${targetType} (ID: ${targetId})`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('trash-restored', { targetId, targetType });
      io.emit('bulk-moderation-update');
    }

    res.json({ message: 'Item restored successfully.' });
  } catch (error) {
    console.error('Error restoring trash item:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to restore item.' });
  }
});

// POST /api/admin/trash/delete - Permanently delete soft-deleted content
router.post('/trash/delete', requireAdmin, async (req, res) => {
  try {
    const { targetId, targetType } = req.body;
    let deleted = false;

    if (targetType === 'message') {
      await LiveChatMessage.findByIdAndDelete(targetId);
      deleted = true;
    } else if (targetType === 'confession') {
      await Confession.findByIdAndDelete(targetId);
      await Report.deleteMany({ targetType: 'confession', targetId });
      deleted = true;
    } else if (targetType === 'meme') {
      const meme = await Meme.findById(targetId);
      if (meme) {
        const publicId = meme.publicId || meme.cloudinaryPublicId;
        if (publicId && isCloudinaryConfigured()) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error('Cloudinary destroy failure during perm delete:', err);
          }
        }
        await Meme.findByIdAndDelete(targetId);
        await Report.deleteMany({ targetType: 'meme', targetId });
        deleted = true;
      }
    } else if (targetType === 'poll') {
      await Poll.findByIdAndDelete(targetId);
      await Report.deleteMany({ targetType: 'poll', targetId });
      deleted = true;
    }

    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not found.' });
    }

    await AdminLog.create({
      action: 'PERM_DELETE_CONTENT',
      details: `Permanently deleted ${targetType} (ID: ${targetId})`,
      adminUsername: req.admin.username
    });

    res.json({ message: 'Item permanently deleted.' });
  } catch (error) {
    console.error('Error permanently deleting item:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete item.' });
  }
});

// DELETE Chat / Confessions / Memes / Polls (Soft Delete mappings)
router.delete('/message/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await LiveChatMessage.findById(id).populate('sender', 'displayName');
    if (!msg) return res.status(404).json({ error: 'NOT_FOUND', message: 'Message not found.' });

    msg.status = 'trash';
    msg.deletedAt = new Date();
    await msg.save();

    await AdminLog.create({
      action: 'SOFT_DELETE_MESSAGE',
      details: `Soft-deleted message from ${msg.sender?.displayName || 'Unknown'}: "${msg.text.substring(0, 40)}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('message-deleted', id);
    }

    res.json({ message: 'Message moved to trash bin.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to soft delete.' });
  }
});

router.delete('/confession/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const conf = await Confession.findById(id).populate('sender', 'displayName');
    if (!conf) return res.status(404).json({ error: 'NOT_FOUND', message: 'Confession not found.' });

    conf.status = 'trash';
    conf.deletedAt = new Date();
    await conf.save();

    await AdminLog.create({
      action: 'SOFT_DELETE_CONFESSION',
      details: `Soft-deleted confession from ${conf.sender?.displayName || 'Unknown'}: "${conf.text.substring(0, 40)}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('confession-deleted', id);
    }

    res.json({ message: 'Confession moved to trash bin.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to soft delete.' });
  }
});

router.delete('/meme/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const meme = await Meme.findById(id).populate('sender', 'displayName');
    if (!meme) return res.status(404).json({ error: 'NOT_FOUND', message: 'Meme not found.' });

    meme.status = 'trash';
    meme.deletedAt = new Date();
    await meme.save();

    await AdminLog.create({
      action: 'SOFT_DELETE_MEME',
      details: `Soft-deleted meme from ${meme.sender?.displayName || 'Unknown'}`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('meme-deleted', id);
    }

    res.json({ message: 'Meme moved to trash bin.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to soft delete.' });
  }
});

router.delete('/poll/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const poll = await Poll.findById(id);
    if (!poll) return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll not found.' });

    poll.status = 'trash';
    poll.deletedAt = new Date();
    await poll.save();

    await AdminLog.create({
      action: 'SOFT_DELETE_POLL',
      details: `Soft-deleted poll: "${poll.question}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('poll-deleted', id);
    }

    res.json({ message: 'Poll moved to trash bin.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to soft delete.' });
  }
});

// Support Inbox Conversations

// GET /api/admin/support/conversations - List support threads
router.get('/support/conversations', requireAdmin, async (req, res) => {
  try {
    const search = req.query.search || '';
    const filter = req.query.filter || 'all'; // 'all', 'unread'
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Aggregate tokens
    const tokens = await SupportMessage.distinct('browserToken');

    const conversationList = [];
    const activeUsers = req.app.get('activeUsers') || new Map();
    const onlineTokens = Array.from(activeUsers.values()).map(u => u.browserToken);

    for (const token of tokens) {
      const user = await User.findOne({ browserToken: token });
      if (!user) continue;

      if (search) {
        const regex = new RegExp(search, 'i');
        const matchName = user.displayName && regex.test(user.displayName);
        const matchReal = user.realName && regex.test(user.realName);
        const matchCampus = user.campus && regex.test(user.campus);
        const matchToken = token && regex.test(token);
        if (!matchName && !matchReal && !matchCampus && !matchToken) {
          continue;
        }
      }

      const unreadCount = await SupportMessage.countDocuments({ browserToken: token, senderType: 'user', isSeen: false });
      
      if (filter === 'unread' && unreadCount === 0) {
        continue;
      }

      const lastMsg = await SupportMessage.findOne({ browserToken: token }).sort({ createdAt: -1 });

      conversationList.push({
        user: {
          id: user._id,
          displayName: user.displayName,
          realName: user.realName || '',
          campus: user.campus || '',
          browserToken: token,
          isBanned: user.isBanned,
          banReason: user.banReason,
          lastActive: user.lastActive,
          isOnline: onlineTokens.includes(token)
        },
        unreadCount,
        lastMessage: lastMsg
      });
    }

    // Sort by last message date
    conversationList.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
      return dateB - dateA;
    });

    const totalConversations = conversationList.length;
    const totalPages = Math.ceil(totalConversations / limit);
    const paginatedList = conversationList.slice((page - 1) * limit, page * limit);

    res.json({
      conversations: paginatedList,
      pagination: {
        totalConversations,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching support conversations:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load conversations.' });
  }
});

// GET /api/admin/support/conversation/:token - Get full history
router.get('/support/conversation/:token', requireAdmin, async (req, res) => {
  try {
    const { token } = req.params;
    const messages = await SupportMessage.find({ browserToken: token }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch conversation thread.' });
  }
});

// POST /api/admin/support/seen/:token - Mark user messages as read by admin
router.post('/support/seen/:token', requireAdmin, async (req, res) => {
  try {
    const { token } = req.params;
    await SupportMessage.updateMany(
      { browserToken: token, senderType: 'user', isSeen: false },
      { $set: { isSeen: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking seen:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update seen receipts.' });
  }
});

// POST /api/admin/support/reply - Send admin reply message
router.post('/support/reply', requireAdmin, (req, res, next) => {
  upload.single('attachment')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'UPLOAD_FAILED', message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { token, text } = req.body;
    const file = req.file;

    if (!token) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Target user browserToken is required.' });
    if ((!text || text.trim() === '') && !file) return res.status(400).json({ error: 'EMPTY_REPLY', message: 'Reply content cannot be empty.' });

    let imageUrl = '';
    if (file) {
      if (isCloudinaryConfigured()) {
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
      } else {
        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');

        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const ext = path.extname(file.originalname) || '.png';
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, file.buffer);
        imageUrl = `/uploads/${filename}`;
      }
    }

    const trimmedText = text ? text.trim() : '';
    const userObj = await User.findOne({ browserToken: token });
    if (userObj && userObj.isRegistered && trimmedText) {
      const isTempPassword = /^[a-zA-Z0-9]{8}$/.test(trimmedText) || req.body.isTempPassword === 'true';
      if (isTempPassword) {
        const hash = await bcrypt.hash(trimmedText, 10);
        userObj.passwordHash = hash;
        userObj.mustChangePassword = true;
        await userObj.save();

        // Also mark pending reset requests as completed
        await PasswordResetRequest.updateMany(
          { username: userObj.displayName, status: 'pending' },
          { $set: { status: 'completed' } }
        );
      }
    }

    const message = await SupportMessage.create({
      browserToken: token,
      senderType: 'admin',
      senderName: getAdminSenderName(req),
      text: trimmedText,
      imageUrl: imageUrl,
      isSeen: false
    });

    await AdminLog.create({
      action: 'SUPPORT_REPLY',
      details: `Replied to support thread for token ${token.substring(0, 10)}...`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to(`support-${token}`).emit('support-message', message);
      io.to('admin').emit('support-message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error replying in support:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send reply.' });
  }
});

// Chat Pinning

router.post('/chat/pin/:messageId', requireAdmin, async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await LiveChatMessage.findById(messageId).populate('sender', 'displayName role');
    if (!msg) return res.status(404).json({ error: 'NOT_FOUND', message: 'Chat message not found.' });

    await PinnedMessage.deleteMany({});
    await PinnedMessage.create({ message: messageId, pinnedBy: 'Professor' });

    await AdminLog.create({
      action: 'PIN_MESSAGE',
      details: `Pinned chat message (ID: ${messageId}) by ${msg.sender?.displayName || 'Unknown'}`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('chat-pinned-message', msg);
    }

    res.json({ message: 'Message pinned successfully.', pinnedMessage: msg });
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to pin message.' });
  }
});

router.post('/chat/unpin', requireAdmin, async (req, res) => {
  try {
    await PinnedMessage.deleteMany({});

    await AdminLog.create({
      action: 'UNPIN_MESSAGE',
      details: 'Unpinned chat message',
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('chat-pinned-message', null);
    }

    res.json({ message: 'Message unpinned successfully.' });
  } catch (error) {
    console.error('Error unpinning message:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to unpin message.' });
  }
});

// GET /api/admin/sessions - Admin Login History Logs
router.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const list = await AdminSession.find({}).sort({ loginTime: -1 });
    res.json(list);
  } catch (error) {
    console.error('Error fetching sessions list:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve login session logs.' });
  }
});

// GET /api/admin/announcements/history - paginated history logs
router.get('/announcements/history', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const filter = req.query.filter || 'all'; // 'all', 'active', 'scheduled', 'expired', 'deleted'

    const match = {};
    if (search) {
      match.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const now = new Date();
    if (filter === 'deleted') {
      match.status = 'trash';
    } else {
      match.status = 'active';
      if (filter === 'active') {
        match.scheduledStart = { $lte: now };
        match.$or = [
          { expiresAt: null },
          { expiresAt: { $gte: now } }
        ];
      } else if (filter === 'scheduled') {
        match.scheduledStart = { $gt: now };
      } else if (filter === 'expired') {
        match.expiresAt = { $lt: now };
      }
    }

    const totalCount = await Announcement.countDocuments(match);
    const totalPages = Math.ceil(totalCount / limit);

    const history = await Announcement.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      history,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching announcements history:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch history.' });
  }
});

// Announcements CRUD

router.post('/announcement', requireAdmin, async (req, res) => {
  try {
    const { title, content, type, scheduledStart, expiresAt, bgColor, textColor } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Title and Content are required.' });

    const announcement = await Announcement.create({
      title,
      content,
      type: type || 'homepage',
      scheduledStart: scheduledStart ? new Date(scheduledStart) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      bgColor: bgColor || '#f3e8ff',
      textColor: textColor || '#6b21a8',
      createdBy: 'Professor'
    });

    await AdminLog.create({
      action: 'CREATE_ANNOUNCEMENT',
      details: `Created announcement: "${title}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('announcements-updated');
    }

    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create.' });
  }
});

router.put('/announcement/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, scheduledStart, expiresAt, bgColor, textColor, status } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ error: 'NOT_FOUND', message: 'Announcement not found.' });

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (scheduledStart !== undefined) announcement.scheduledStart = scheduledStart ? new Date(scheduledStart) : new Date();
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (bgColor) announcement.bgColor = bgColor;
    if (textColor) announcement.textColor = textColor;
    if (status) announcement.status = status;

    await announcement.save();

    await AdminLog.create({
      action: 'EDIT_ANNOUNCEMENT',
      details: `Modified announcement: "${announcement.title}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('announcements-updated');
    }

    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to edit.' });
  }
});

router.delete('/announcement/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement) return res.status(404).json({ error: 'NOT_FOUND', message: 'Announcement not found.' });

    // Soft delete
    announcement.status = 'trash';
    await announcement.save();

    await AdminLog.create({
      action: 'SOFT_DELETE_ANNOUNCEMENT',
      details: `Soft-deleted announcement: "${announcement.title}"`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.emit('announcements-updated');
    }

    res.json({ message: 'Announcement soft deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete.' });
  }
});

// POST /api/admin/backup
router.post('/backup', requireAdmin, async (req, res) => {
  try {
    const result = await runDatabaseBackup();
    res.json(result);
  } catch (error) {
    console.error('Backup trigger error:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Backup execution failed.' });
  }
});

// GET /api/admin/backup/status
router.get('/backup/status', requireAdmin, async (req, res) => {
  try {
    const statusSetting = await Settings.findOne({ key: 'last_backup_status' });
    if (statusSetting) {
      res.json(statusSetting.value);
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch status.' });
  }
});

// POST /api/admin/report/:id/action
router.post('/report/:id/action', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, durationMinutes, banReason } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Report not found.' });
    }

    let logDetail = '';
    const io = getIo(req);

    if (action === 'ignore') {
      report.status = 'resolved';
      await report.save();
      logDetail = `Ignored report ${id}`;
    } else if (action === 'delete_content') {
      if (report.targetType === 'message') {
        await LiveChatMessage.findByIdAndUpdate(report.targetId, { status: 'trash', deletedAt: new Date() });
        if (io) io.emit('message-deleted', report.targetId);
      } else if (report.targetType === 'confession') {
        await Confession.findByIdAndUpdate(report.targetId, { status: 'trash', deletedAt: new Date() });
        if (io) io.emit('confession-deleted', report.targetId);
      } else if (report.targetType === 'meme') {
        await Meme.findByIdAndUpdate(report.targetId, { status: 'trash', deletedAt: new Date() });
        if (io) io.emit('meme-deleted', report.targetId);
      } else if (report.targetType === 'poll') {
        await Poll.findByIdAndUpdate(report.targetId, { status: 'trash', deletedAt: new Date() });
        if (io) io.emit('poll-deleted', report.targetId);
      }
      report.status = 'resolved';
      await report.save();
      logDetail = `Soft-deleted reported ${report.targetType} target content and resolved report ${id}`;
    } else if (action === 'ban_user') {
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
      } else if (report.targetType === 'poll') {
        const poll = await Poll.findById(report.targetId);
        if (poll) {
          const usr = await User.findById(poll.sender);
          if (usr) targetUserToken = usr.browserToken;
        }
      }

      if (targetUserToken) {
        const userObj = await User.findOne({ browserToken: targetUserToken });
        if (userObj) {
          userObj.isBanned = true;
          userObj.banReason = banReason || 'Reported content violation';
          userObj.bannedBy = 'Professor';
          userObj.banDate = new Date();
          await userObj.save();

          const reasonText = banReason || 'Reported content violation';
          const banMsg = `🚫 Your account has been banned.\n\nReason:\n${reasonText}\n\nIf you believe this is a mistake, you can reply here to appeal your ban.`;
          await sendSystemSupportMessage(targetUserToken, banMsg, req);

          if (io) {
            io.emit('user-banned-alert', targetUserToken);
            io.to('admin').emit('user-ban-status-updated', { userId: userObj._id, isBanned: true });
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
      } else if (report.targetType === 'poll') {
        const poll = await Poll.findById(report.targetId);
        if (poll) {
          const usr = await User.findById(poll.sender);
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

// GET /api/admin/registered-users
router.get('/registered-users', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const campusFilter = req.query.campusFilter || '';
    const banFilter = req.query.banFilter || '';
    const sortBy = req.query.sortBy || 'registrationDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = { isRegistered: true };

    if (search) {
      query.$or = [
        { realName: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { campus: { $regex: search, $options: 'i' } }
      ];
    }

    if (campusFilter) {
      query.campus = campusFilter;
    }

    if (banFilter === 'banned') {
      query.isBanned = true;
    } else if (banFilter === 'active') {
      query.isBanned = false;
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching registered users:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch registered users.' });
  }
});

// GET /api/admin/banned-users
router.get('/banned-users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const campusFilter = req.query.campusFilter || '';
    const filter = req.query.filter || 'all'; // 'all', 'pending', 'replied', 'permanent'
    const sortBy = req.query.sortBy || 'banDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = { isBanned: true };

    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { realName: { $regex: search, $options: 'i' } },
        { campus: { $regex: search, $options: 'i' } }
      ];
    }

    if (campusFilter) {
      query.campus = campusFilter;
    }

    let users = await User.find(query);

    const processedUsers = [];
    for (const u of users) {
      const lastMsg = await SupportMessage.findOne({ browserToken: u.browserToken }).sort({ createdAt: -1 });
      
      let appealStatus = 'None';
      if (lastMsg) {
        appealStatus = lastMsg.senderType === 'user' ? 'Pending' : 'Replied';
      }

      if (filter === 'pending' && appealStatus !== 'Pending') continue;
      if (filter === 'replied' && appealStatus !== 'Replied') continue;

      const warningCount = u.warnings ? u.warnings.length : 0;

      const uObj = u.toObject();
      if (req.admin.role === 'sub_admin') {
        uObj.realName = '[REDACTED]';
        uObj.campus = '[REDACTED]';
      }

      processedUsers.push({
        ...uObj,
        appealStatus,
        warningCount
      });
    }

    processedUsers.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const total = processedUsers.length;
    const paginatedUsers = processedUsers.slice((page - 1) * limit, page * limit);

    res.json({
      users: paginatedUsers,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Error fetching banned users:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch banned users.' });
  }
});

router.get('/registered-users/:id/details', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    // Redact private fields if Berlin / sub-admin
    if (req.admin.role === 'sub_admin') {
      user.realName = '[REDACTED]';
      user.campus = '[REDACTED]';
      user.browserToken = '[REDACTED]';
      user.ip = '[REDACTED]';
      user.browser = '[REDACTED]';
      if (user.registrationDate) {
        user.registrationDate = null;
      }
      if (user.lastLogin) {
        user.lastLogin = null;
      }
      if (user.lastSeen) {
        user.lastSeen = null;
      }
    }

    const warningCount = user.warnings ? user.warnings.length : 0;
    const totalMessages = await LiveChatMessage.countDocuments({ sender: userId, status: { $ne: 'trash' } });
    const totalConfessions = await Confession.countDocuments({ sender: userId, status: { $ne: 'trash' } });
    const totalMemes = await Meme.countDocuments({ sender: userId, status: { $ne: 'trash' } });
    const totalPolls = await Poll.countDocuments({ sender: userId, status: { $ne: 'trash' } });

    res.json({
      user,
      warningCount,
      totalMessages,
      totalConfessions,
      totalMemes,
      totalPolls
    });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch user details.' });
  }
});

// GET /api/admin/export-users
router.get('/export-users', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({ isRegistered: true }).sort({ registrationDate: -1 });

    const data = [];
    for (const u of users) {
      const warningCount = u.warnings ? u.warnings.length : 0;
      const totalMessages = await LiveChatMessage.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const totalConfessions = await Confession.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const totalMemes = await Meme.countDocuments({ sender: u._id, status: { $ne: 'trash' } });
      const totalPolls = await Poll.countDocuments({ sender: u._id, status: { $ne: 'trash' } });

      data.push({
        'Real Name': u.realName || '',
        'Campus': u.campus || '',
        'Anonymous Username': u.displayName || '',
        'Registration Date': u.registrationDate ? u.registrationDate.toISOString() : '',
        'Last Login': u.lastLogin ? u.lastLogin.toISOString() : '',
        'Last Seen': u.lastActive ? u.lastActive.toISOString() : '',
        'Ban Status': u.isBanned ? 'Banned' : 'Active',
        'Warning Count': warningCount,
        'Total Messages': totalMessages,
        'Total Confessions': totalConfessions,
        'Total Memes': totalMemes,
        'Total Polls': totalPolls
      });
    }

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Registered Users');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Registered_Users.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Error exporting users:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to export users to Excel.' });
  }
});

// DELETE /api/admin/registered-users/:id
router.delete('/registered-users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Restriction check: sub_admin can only delete user if the user is banned
    if (req.admin.role === 'sub_admin' && !user.isBanned) {
      return res.status(403).json({ error: 'ADMIN_FORBIDDEN', message: 'ACCESS DENIED. Super Admin privileges required.' });
    }

    await User.findByIdAndDelete(req.params.id);

    await AdminLog.create({
      action: 'DELETE_ACCOUNT',
      details: `Admin deleted registered account of ${user.displayName} (Real Name: ${user.realName})`,
      adminUsername: req.admin.username
    });

    const io = getIo(req);
    if (io) {
      io.to('admin').emit('moderation-activity', {
        type: 'delete_account',
        text: `Admin deleted registered account of ${user.displayName}`,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete account.' });
  }
});

// POST /api/admin/reset-requests/direct-reset
router.post('/reset-requests/direct-reset', requireAdmin, async (req, res) => {
  try {
    const { userId, tempPassword } = req.body;
    if (!userId || !tempPassword) {
      return res.status(400).json({ message: 'User ID and temporary password are required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hash = await bcrypt.hash(tempPassword, 10);
    user.passwordHash = hash;
    user.mustChangePassword = true;
    await user.save();

    const messageText = `Identity verified.\n\nTemporary Password:\n\n${tempPassword}\n\nPlease login using this password.\n\nYou must change your password immediately after logging in.`;
    
    const senderName = getAdminSenderName(req);
    await SupportMessage.create({
      browserToken: user.browserToken,
      senderType: 'admin',
      senderName,
      text: messageText,
      isSeen: false
    });

    const io = getIo(req);
    if (io) {
      io.to(`support-${user.browserToken}`).emit('support-message', {
        browserToken: user.browserToken,
        senderType: 'admin',
        senderName,
        text: messageText,
        createdAt: new Date()
      });
    }

    res.json({ message: 'Temporary password generated and sent successfully.', tempPassword });
  } catch (err) {
    console.error('Error handling direct reset password:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to generate temporary password.' });
  }
});

// GET /api/admin/reset-requests
router.get('/reset-requests', requireAdmin, async (req, res) => {
  try {
    let requests = await PasswordResetRequest.find().sort({ createdAt: -1 });
    if (req.admin.role === 'sub_admin' || req.admin.role === 'sub-admin') {
      requests = requests.map(r => {
        const obj = r.toObject();
        obj.realName = '[REDACTED]';
        obj.campus = '[REDACTED]';
        return obj;
      });
    }
    res.json(requests);
  } catch (err) {
    console.error('Error fetching reset requests:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch reset requests.' });
  }
});

// POST /api/admin/reset-requests/:id/action
router.post('/reset-requests/:id/action', requireAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (action === 'approve') {
      const tempPassword = Math.random().toString(36).substring(2, 10);
      const user = await User.findOne({ displayName: request.username });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const hash = await bcrypt.hash(tempPassword, 10);
      user.passwordHash = hash;
      user.mustChangePassword = true;
      await user.save();

      const messageText = `Identity verified.\n\nTemporary Password:\n\n${tempPassword}\n\nPlease login using this password.\n\nYou must change your password immediately after logging in.`;
      
      const senderName = getAdminSenderName(req);
      await SupportMessage.create({
        browserToken: user.browserToken,
        senderType: 'admin',
        senderName,
        text: messageText,
        isSeen: false
      });

      const io = getIo(req);
      if (io) {
        io.to(`support-${user.browserToken}`).emit('support-message', {
          browserToken: user.browserToken,
          senderType: 'admin',
          senderName,
          text: messageText,
          createdAt: new Date()
        });
      }

      request.status = 'completed';
      await request.save();

      res.json({ message: 'Temporary password generated and sent successfully.', tempPassword });
    } else if (action === 'reject') {
      request.status = 'rejected';
      await request.save();
      res.json({ message: 'Password reset request rejected.' });
    } else {
      res.status(400).json({ message: 'Invalid action.' });
    }
  } catch (err) {
    console.error('Error handling reset request action:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to act on reset request.' });
  }
});

export default router;
