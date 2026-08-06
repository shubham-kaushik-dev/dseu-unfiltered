import jwt from 'jsonwebtoken';

const FAILED_LOGIN_LIMIT = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes lockout

const loginAttempts = new Map();

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

export function registerFailedAttempt(ip) {
  let attempt = loginAttempts.get(ip);
  if (!attempt) {
    attempt = { count: 0, lockUntil: null };
  }

  attempt.count += 1;

  if (attempt.count >= FAILED_LOGIN_LIMIT) {
    attempt.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    attempt.count = 0; // Reset count
    loginAttempts.set(ip, attempt);
    return true;
  }

  loginAttempts.set(ip, attempt);
  return false;
}

export function clearFailedAttempts(ip) {
  loginAttempts.delete(ip);
}

export function requireAdmin(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED', message: 'Unauthorized. Admin session missing.' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    const superAdminUsername = 'Professor';
    const envAdminUsername = process.env.ADMIN_USERNAME || 'Kaushik';
    const subAdminUsername = 'berlin';
    const subAdminUsername2 = 'admin123';
    
    if (decoded.username !== superAdminUsername && 
        decoded.username !== envAdminUsername && 
        decoded.username !== subAdminUsername &&
        decoded.username !== subAdminUsername2) {
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
          message: 'Invalid CSRF token. Request verification failed.'
        });
      }
    }

    // Attach admin info to request
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin Auth Error:', error);
    return res.status(401).json({ error: 'ADMIN_SESSION_EXPIRED', message: 'Session expired. Please log in again.' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'ADMIN_UNAUTHORIZED', message: 'Unauthorized. Admin session missing.' });
  }
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'ADMIN_FORBIDDEN', message: 'ACCESS DENIED. Super Admin privileges required.' });
  }
  next();
}
