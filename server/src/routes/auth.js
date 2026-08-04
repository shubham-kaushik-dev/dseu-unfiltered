import express from 'express';
import { parseUser } from '../middleware/auth.js';

const router = express.Router();

// GET /api/me
// Automatically registers user if they don't have an identity, then returns user object.
router.get('/me', parseUser, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      displayName: req.user.displayName,
      browserToken: req.user.browserToken,
      campus: req.user.campus,
      mutedUntil: req.user.mutedUntil,
      isBanned: req.user.isBanned
    }
  });
});

export default router;
