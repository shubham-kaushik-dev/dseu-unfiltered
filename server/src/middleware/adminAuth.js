import jwt from 'jsonwebtoken';

const FAILED_LOGIN_LIMIT = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes lockout

// In-memory store for failed login attempts and lockouts
const loginAttempts = new Map();

/**
 * Checks if the IP is currently locked out of admin login.
 */
export function checkLoginLockout(ip) {
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.lockUntil && attempt.lockUntil > new Date()) {
    return {
      isLocked: true,
      remainingTime: Math.ceil((attempt.lockUntil - new Date()) / 1000) // seconds
    };
  }
  return { isLocked: false };
}

/**
 * Registers a failed login attempt for the given IP.
 * Returns true if the IP is now locked.
 */
export function registerFailedAttempt(ip) {
  let attempt = loginAttempts.get(ip);
  if (!attempt) {
    attempt = { count: 0, lockUntil: null };
  }

  attempt.count += 1;

  if (attempt.count >= FAILED_LOGIN_LIMIT) {
    attempt.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    attempt.count = 0; // Reset count for after lock expires
    loginAttempts.set(ip, attempt);
    return true;
  }

  loginAttempts.set(ip, attempt);
  return false;
}

/**
 * Clears failed login attempts for the given IP.
 */
export function clearFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

/**
 * Middleware to protect admin routes.
 * Decodes the JWT token from the HttpOnly cookie.
 */
export function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.dseu_unfiltered_admin;

    if (!token) {
      return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED', message: 'Admin authentication required.' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if the decoded payload username matches
    if (decoded.username !== (process.env.ADMIN_USERNAME || 'administrator')) {
      return res.status(403).json({ error: 'ADMIN_FORBIDDEN', message: 'Invalid admin credentials.' });
    }

    // CSRF validation for state-changing endpoints
    const stateChangingMethods = ['POST', 'PUT', 'DELETE'];
    if (stateChangingMethods.includes(req.method)) {
      const csrfHeader = req.headers['x-csrf-token'];
      const csrfTokenInPayload = decoded.csrfToken;

      if (!csrfHeader || !csrfTokenInPayload || csrfHeader !== csrfTokenInPayload) {
        return res.status(403).json({
          error: 'CSRF_FAILED',
          message: 'Security validation failed (CSRF check failed). Unauthorized request.'
        });
      }
    }

    // Attach admin info to request
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);
    res.clearCookie('dseu_unfiltered_admin');
    return res.status(401).json({ error: 'ADMIN_SESSION_EXPIRED', message: 'Admin session expired or invalid. Please login again.' });
  }
}
