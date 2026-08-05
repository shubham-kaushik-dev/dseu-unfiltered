import express from 'express';
import { parseUser } from '../middleware/auth.js';

const router = express.Router();

// GET /api/auth/me
router.get('/me', parseUser, (req, res) => {
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
      warnings: req.user.warnings
    }
  });
});

export default router;
