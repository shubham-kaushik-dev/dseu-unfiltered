import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateUniqueIdentity } from '../utils/identity.js';

export async function parseUser(req, res, next) {
  try {
    // 1. Check if admin token is present and valid in Authorization header
    let isAdmin = false;
    let adminToken = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      adminToken = authHeader.substring(7);
    }

    if (adminToken) {
      try {
        const decoded = jwt.verify(adminToken, process.env.JWT_SECRET || 'fallback_secret');
        if (decoded && decoded.username === (process.env.ADMIN_USERNAME || 'Kaushik') && decoded.role === 'admin') {
          isAdmin = true;
        }
      } catch (err) {
        // Admin token expired or invalid, or not a JWT
      }
    }

    let user = null;

    if (isAdmin) {
      // Find or create the permanent admin user
      user = await User.findOne({ role: 'admin' });
      if (!user) {
        user = await User.create({
          browserToken: 'admin-token-fixed-value-2026',
          displayName: 'Professor (ADMIN)',
          role: 'admin',
          campus: 'DSEU'
        });
      }
    } else {
      // 2. Extract standard token from cookie, header, or custom header
      let token = req.cookies?.dseu_unfiltered_token;

      if (!token && req.headers['authorization']) {
        const authHeader = req.headers['authorization'];
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        token = req.headers['x-anonymous-token'];
      }

      if (token) {
        // Find existing user, ensuring we never match the admin user dynamically from random tokens
        user = await User.findOne({ browserToken: token, role: { $ne: 'admin' } });
      }

      // 3. If no token or user exists, auto-register a new anonymous user
      if (!user) {
        token = crypto.randomUUID();
        const displayName = await generateUniqueIdentity();

        user = await User.create({
          browserToken: token,
          displayName: displayName,
          campus: 'DSEU',
          lastActive: new Date()
        });

        // Set cookie
        res.cookie('dseu_unfiltered_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
        });
        
        // Save token on response headers to allow frontend fallback
        res.setHeader('x-set-anonymous-token', token);
      } else {
        // Update last active activity details
        user.lastActive = new Date();
        user.browser = req.headers['user-agent'] || '';
        user.ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
        await user.save();
      }
    }

    // 4. Strict Ban Checks
    if (user && user.isBanned) {
      // Allow only safe routes (like fetching auth status or using support chat)
      const isBannedSafeRoute = req.originalUrl === '/api/auth/me' || req.originalUrl.startsWith('/api/support');
      if (!isBannedSafeRoute) {
        return res.status(403).json({
          error: 'YOUR_IDENTITY_IS_BANNED',
          message: user.banReason || 'Your anonymous identity has been permanently banned by an administrator.',
          banReason: user.banReason,
          bannedBy: user.bannedBy || 'Professor',
          banDate: user.banDate || user.updatedAt
        });
      }
    }

    // 5. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication processing error.' });
  }
}

// Stricter check that assumes identity must be fully loaded
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'You must have a valid anonymous identity.' });
  }
  
  // Check if muted
  if (req.user.mutedUntil && req.user.mutedUntil > new Date()) {
    const remainingTime = Math.ceil((req.user.mutedUntil - new Date()) / 1000 / 60);
    return res.status(403).json({ 
      error: 'USER_MUTED', 
      message: `You are temporarily muted. You can interact again in ${remainingTime} minutes.` 
    });
  }

  next();
}
