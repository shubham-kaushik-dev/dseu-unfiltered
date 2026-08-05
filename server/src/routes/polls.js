import express from 'express';
import Poll from '../models/Poll.js';
import { parseUser, requireAuth } from '../middleware/auth.js';
import { interactionLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const getIo = (req) => req.app.get('io');

// GET /api/polls - Get all active polls
router.get('/', parseUser, async (req, res) => {
  try {
    const polls = await Poll.find({ campus: req.user?.campus || 'DSEU', isActive: true, status: { $ne: 'trash' } })
      .populate('sender', 'displayName')
      .sort({ createdAt: -1 });

    res.json(polls);
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch polls.' });
  }
});

// POST /api/polls/:id/vote - Cast/Toggle vote on a poll
router.post('/:id/vote', parseUser, requireAuth, interactionLimiter, async (req, res) => {
  try {
    const pollId = req.params.id;
    const { optionId } = req.body;
    const userToken = req.user.browserToken;

    if (!optionId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Option ID is required.' });
    }

    const poll = await Poll.findById(pollId);
    if (!poll || !poll.isActive) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Active poll not found.' });
    }

    // Find the option the user wants to vote for
    const targetOption = poll.options.id(optionId);
    if (!targetOption) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Poll option not found.' });
    }

    // Toggle logic & single vote enforcement:
    // Remove the user's vote from ALL options of this poll
    let votedForSameOption = false;

    poll.options.forEach(option => {
      const index = option.votes.indexOf(userToken);
      if (index > -1) {
        option.votes.splice(index, 1);
        if (option._id.toString() === optionId) {
          votedForSameOption = true;
        }
      }
    });

    // If they were NOT already voting for this option, add their vote (standard toggle behavior)
    if (!votedForSameOption) {
      targetOption.votes.push(userToken);
    }

    await poll.save();

    const updatedPoll = await Poll.findById(pollId).populate('sender', 'displayName');

    // Emit live socket update to all connected clients
    const io = getIo(req);
    if (io) {
      io.emit('poll-updated', updatedPoll);
    }

    res.json(updatedPoll);
  } catch (error) {
    console.error('Error voting in poll:', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to record vote.' });
  }
});

export default router;
