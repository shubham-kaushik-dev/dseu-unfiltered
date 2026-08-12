import express from 'express';
import { parseUser } from '../middleware/auth.js';
import User from '../models/User.js';
import { getVapidPublicKey } from '../utils/webPushHelper.js';

const router = express.Router();

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();
  res.json({ publicKey });
});

// POST /api/push/subscribe
router.post('/subscribe', parseUser, async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'INVALID_SUBSCRIPTION', message: 'Subscription object required.' });
    }

    const userId = req.user._id;

    // Avoid duplicate subscriptions for the same user with the same endpoint
    await User.updateOne(
      { _id: userId, 'pushSubscriptions.endpoint': { $ne: subscription.endpoint } },
      { $push: { pushSubscriptions: subscription } }
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to subscribe user.' });
  }
});

export default router;
