import crypto from 'crypto';
import User from '../models/User.js';
import { generateUniqueIdentity } from '../utils/identity.js';

export async function parseUser(req, res, next) {
  try {
    // 1. Extract token from cookie or authorization header
    let token = req.cookies?.dseu_unfiltered_token;

    if (!token && req.headers['authorization']) {
      const authHeader = req.headers['authorization'];
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // Fallback: Custom header
    if (!token) {
      token = req.headers['x-anonymous-token'];
    }

    let user = null;

    if (token) {
      // Find existing user
      user = await User.findOne({ browserToken: token });
    }

    // 2. If no token or user exists, auto-register a new anonymous user
    if (!user) {
      // Generate a new secure token
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
        secure: true, // Always set to true since we are deploying to Render/Vercel (HTTPS), but we can relax for localhost if needed. Let's make it secure: false for localhost, true for production.
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
      });
      
      // Save token on response headers to allow frontend fallback
      res.setHeader('x-set-anonymous-token', token);
    } else {
      // Update last active
      user.lastActive = new Date();
      await user.save();
    }

    // 3. Check if user is banned
    if (user.isBanned) {
      return res.status(403).json({ error: 'YOUR_IDENTITY_IS_BANNED', message: 'Your anonymous identity has been permanently banned by an administrator.' });
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(500).json({ error: 'AUTH_ERROR', message: 'Authentication processing error.' });
  }
}

// Stricter check that assumes identity must be fully loaded (usually parsed via parseUser first)
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
