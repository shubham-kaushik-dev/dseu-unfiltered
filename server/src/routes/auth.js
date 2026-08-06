import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { parseUser } from '../middleware/auth.js';
import User from '../models/User.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import SupportMessage from '../models/SupportMessage.js';
import AdminNotification from '../models/AdminNotification.js';

const router = express.Router();

// GET /api/auth/me
router.get('/me', parseUser, (req, res) => {
  res.cookie('dseu_unfiltered_token', req.user.browserToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
  });

  res.json({
    user: {
      id: req.user._id,
      displayName: req.user.displayName,
      browserToken: req.user.browserToken,
      campus: req.user.campus,
      mutedUntil: req.user.mutedUntil,
      isBanned: req.user.isBanned,
      banReason: req.user.banReason,
      bannedBy: req.user.bannedBy,
      banDate: req.user.banDate,
      role: req.user.role,
      isShadowBanned: req.user.isShadowBanned,
      warnings: req.user.warnings,
      isRegistered: req.user.isRegistered,
      realName: req.user.realName,
      registrationDate: req.user.registrationDate,
      mustChangePassword: req.user.mustChangePassword
    }
  });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { realName, campus, displayName, password, browserToken } = req.body;

    if (!realName || !campus || !displayName || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Username uniqueness validation
    const existing = await User.findOne({ displayName: { $regex: new RegExp(`^${displayName}$`, 'i') } });
    if (existing && (!browserToken || existing.browserToken !== browserToken)) {
      return res.status(400).json({ message: 'Anonymous Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user = null;
    if (browserToken) {
      user = await User.findOne({ browserToken });
    }

    if (user) {
      user.realName = realName;
      user.campus = campus;
      user.displayName = displayName;
      user.passwordHash = passwordHash;
      user.isRegistered = true;
      user.registrationDate = new Date();
      user.lastLogin = new Date();
      await user.save();
    } else {
      const token = crypto.randomUUID();
      user = await User.create({
        browserToken: token,
        displayName,
        realName,
        campus,
        passwordHash,
        isRegistered: true,
        registrationDate: new Date(),
        lastLogin: new Date()
      });
    }

    await AdminNotification.create({
      text: `New student registered: ${displayName} (${realName})`,
      type: 'new_user',
      data: { userId: user._id }
    });

    const getIo = (r) => r.app.get('io');
    const io = getIo(req);
    if (io) {
      io.to('admin').emit('admin-notifications-updated');
    }

    res.cookie('dseu_unfiltered_token', user.browserToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });

    res.json({
      message: 'Account registered successfully.',
      token: user.browserToken,
      user: {
        id: user._id,
        displayName: user.displayName,
        browserToken: user.browserToken,
        campus: user.campus,
        role: user.role,
        isRegistered: user.isRegistered,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ displayName: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user || !user.isRegistered || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid Anonymous Username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Anonymous Username or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    res.cookie('dseu_unfiltered_token', user.browserToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });

    res.json({
      token: user.browserToken,
      user: {
        id: user._id,
        displayName: user.displayName,
        browserToken: user.browserToken,
        campus: user.campus,
        role: user.role,
        isRegistered: user.isRegistered,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', parseUser, async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (!req.user || !req.user.isRegistered) {
      return res.status(401).json({ message: 'Unauthorized. Not a registered user.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const dbUser = await User.findById(req.user._id);
    dbUser.passwordHash = hash;
    dbUser.mustChangePassword = false;
    await dbUser.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ message: 'Internal server error changing password.' });
  }
});

// POST /api/auth/update-profile
router.post('/update-profile', parseUser, async (req, res) => {
  try {
    const { displayName, password } = req.body;

    if (!req.user || !req.user.isRegistered) {
      return res.status(401).json({ message: 'Unauthorized. Not a registered user.' });
    }

    const dbUser = await User.findById(req.user._id);

    if (displayName && displayName !== dbUser.displayName) {
      const existing = await User.findOne({ displayName: { $regex: new RegExp(`^${displayName}$`, 'i') } });
      if (existing) {
        return res.status(400).json({ message: 'Anonymous Username is already taken.' });
      }
      dbUser.displayName = displayName;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      }
      dbUser.passwordHash = await bcrypt.hash(password, 10);
    }

    await dbUser.save();

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: dbUser._id,
        displayName: dbUser.displayName,
        browserToken: dbUser.browserToken,
        campus: dbUser.campus,
        role: dbUser.role,
        isRegistered: dbUser.isRegistered,
        mustChangePassword: dbUser.mustChangePassword
      }
    });
  } catch (err) {
    console.error('Update Profile Error:', err);
    res.status(500).json({ message: 'Internal server error updating profile.' });
  }
});

// POST /api/auth/reset-request
router.post('/reset-request', async (req, res) => {
  try {
    const { username, realName, campus, reason } = req.body;

    if (!username || !realName || !campus || !reason) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Find the registered user to map the recovery to support conversation
    const user = await User.findOne({ displayName: username, isRegistered: true });
    if (!user) {
      return res.status(404).json({ message: 'Registered user with this anonymous username not found.' });
    }

    await PasswordResetRequest.create({
      username,
      realName,
      campus,
      reason
    });

    await AdminNotification.create({
      text: `Password reset request from ${username}`,
      type: 'reset_request',
      data: { username }
    });

    const msgText = `Password Reset Request

Username: ${username}
Campus: ${campus}
Reason: ${reason}

The administrator has been notified.
Please wait while the administrator verifies your identity.`;

    // Automatically create direct Support Message
    await SupportMessage.create({
      browserToken: user.browserToken,
      senderType: 'user',
      senderName: user.displayName,
      text: msgText,
      isSeen: false
    });

    const getIo = (r) => r.app.get('io');
    const io = getIo(req);
    if (io) {
      // Notify admin channel
      io.to('admin').emit('support-message', {
        browserToken: user.browserToken,
        senderType: 'user',
        senderName: user.displayName,
        text: msgText,
        createdAt: new Date()
      });
      // Notify user's specific room
      io.to(`support-${user.browserToken}`).emit('support-message', {
        browserToken: user.browserToken,
        senderType: 'user',
        senderName: user.displayName,
        text: msgText,
        createdAt: new Date()
      });
      io.to('admin').emit('admin-notifications-updated');
    }

    res.json({ 
      message: 'Password reset request submitted successfully.',
      browserToken: user.browserToken
    });
  } catch (err) {
    console.error('Reset Request Error:', err);
    res.status(500).json({ message: 'Internal server error submitting request.' });
  }
});

export default router;
