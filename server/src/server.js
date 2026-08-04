import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import { checkMaintenance } from './middleware/maintenance.js';
import { initBackupScheduler } from './utils/backup.js';
import { logger } from './utils/logger.js';

// Routes
import authRouter from './routes/auth.js';
import confessionsRouter from './routes/confessions.js';
import memesRouter from './routes/memes.js';
import pollsRouter from './routes/polls.js';
import adminRouter from './routes/admin.js';

// Models & Utils
import User from './models/User.js';
import LiveChatMessage from './models/LiveChatMessage.js';
import Settings from './models/Settings.js';
import { seedDatabase } from './utils/seeder.js';
import { filterProfanity } from './utils/profanity.js';

// Trigger nodemon restart
const app = express();
const PORT = process.env.PORT || 5000;

// Security and parser middlewares
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: false,
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "http:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'same-origin' } // Referrer-Policy
}));

// Permissions-Policy header
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve local uploads in development
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

import { parseUser } from './middleware/auth.js';

// Maintenance Mode middleware interceptor
app.use(checkMaintenance);

// Attach API Routes
app.use('/api/auth', authRouter);
app.use('/api/confessions', confessionsRouter);
app.use('/api/memes', memesRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/admin', adminRouter);

// Fetch chat history (latest 50 messages chronologically)
app.get('/api/chat', parseUser, async (req, res) => {
  try {
    const messages = await LiveChatMessage.find({ campus: req.user?.campus || 'DSEU' })
      .populate('sender', 'displayName')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(messages.reverse());
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve messages.' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('DSEU Unfiltered API Service is running.');
});

// Create HTTP server
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from frontend dev server
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Share Socket.IO instance with routers
app.set('io', io);

// Local in-memory state for sockets
const activeUsers = new Map(); // socket.id -> { userObj, browserToken }
app.set('activeUsers', activeUsers);
const lastMessageTimes = new Map(); // browserToken -> timestamp (for slow mode)

// Global database connection
logger.info('Connecting to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dseu_unfiltered')
  .then(async () => {
    logger.info('MongoDB Connected successfully.');
    // Seed initial mock data if database is empty
    await seedDatabase();
    // Initialize automatic daily database backups
    initBackupScheduler();
  })
  .catch(err => {
    logger.error('MongoDB connection error', { error: err.message });
  });

// Socket.IO event handler
io.on('connection', async (socket) => {
  // Join general room
  socket.join('public-chat');

  // Trigger online user count update
  io.emit('online-count', io.sockets.sockets.size);
  
  // Notify admin channel of new user join
  io.to('admin').emit('admin-stats-update', { onlineUsers: io.sockets.sockets.size });

  // Handle client register identity mapping
  socket.on('register-identity', async (token) => {
    try {
      if (!token) return;

      const user = await User.findOne({ browserToken: token });
      if (user) {
        if (user.isBanned) {
          socket.emit('banned-redirect');
          socket.disconnect();
          return;
        }

        activeUsers.set(socket.id, {
          id: user._id,
          displayName: user.displayName,
          browserToken: token,
          isBanned: user.isBanned,
          mutedUntil: user.mutedUntil
        });

        // Broadcast status change
        io.emit('user-status-change', {
          userId: user._id,
          browserToken: token,
          isOnline: true,
          lastActive: user.lastActive
        });

        // Broadcast join message to admin activity timeline
        io.to('admin').emit('moderation-activity', {
          type: 'user_joined',
          text: `🟢 ${user.displayName} connected to community`,
          timestamp: new Date()
        });
      }
    } catch (err) {
      console.error('Socket identity registration error:', err);
    }
  });

  // Check if admin connects
  socket.on('admin-join', () => {
    socket.join('admin');
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const active = activeUsers.get(socket.id);
    if (!active) return;

    socket.to('public-chat').emit('user-typing', {
      displayName: active.displayName,
      isTyping: data.isTyping
    });
  });

  // Handle live chat messages
  socket.on('send-chat-message', async (text) => {
    try {
      const active = activeUsers.get(socket.id);
      if (!active) {
        return socket.emit('chat-error', { message: 'Register your identity first.' });
      }

      // Re-fetch user status to ensure they aren't banned/muted in real time
      const user = await User.findById(active.id);
      if (!user || user.isBanned) {
        return socket.emit('chat-error', { message: 'Your identity is banned.' });
      }

      if (user.mutedUntil && user.mutedUntil > new Date()) {
        const remaining = Math.ceil((user.mutedUntil - new Date()) / 1000 / 60);
        return socket.emit('chat-error', { message: `You are muted. Try again in ${remaining} minutes.` });
      }

      if (!text || typeof text !== 'string' || text.trim() === '') {
        return socket.emit('chat-error', { message: 'Message content cannot be empty.' });
      }

      if (text.length > 500) {
        return socket.emit('chat-error', { message: 'Message is too long (max 500 chars).' });
      }

      // Enforce slow-mode if active
      const slowModeSetting = await Settings.findOne({ key: 'slow_mode_seconds' });
      const slowModeSeconds = slowModeSetting ? slowModeSetting.value : 0;

      if (slowModeSeconds > 0) {
        const lastTime = lastMessageTimes.get(active.browserToken) || 0;
        const timeDiff = (Date.now() - lastTime) / 1000;
        if (timeDiff < slowModeSeconds) {
          const cooldownRemaining = Math.ceil(slowModeSeconds - timeDiff);
          return socket.emit('chat-error', { 
            message: `Slow mode is active. Wait ${cooldownRemaining}s before sending another message.` 
          });
        }
      }

      // Update slow-mode track
      lastMessageTimes.set(active.browserToken, Date.now());

      // Sanitize profanity
      const sanitizedText = filterProfanity(text.trim());

      const chatMsg = await LiveChatMessage.create({
        text: sanitizedText,
        sender: active.id,
        campus: user.campus || 'DSEU',
        reactions: new Map([
          ['❤️', []],
          ['😂', []],
          ['🔥', []]
        ])
      });

      const populatedMsg = await LiveChatMessage.findById(chatMsg._id).populate('sender', 'displayName');

      // Broadcast message to everyone
      io.emit('new-chat-message', populatedMsg);

      // Notify admin panel
      io.to('admin').emit('moderation-activity', {
        type: 'chat_sent',
        text: `Message from ${active.displayName}: "${sanitizedText.substring(0, 30)}..."`,
        timestamp: new Date()
      });

      const totalChatMessages = await LiveChatMessage.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalChatMessages });

    } catch (err) {
      console.error('Socket chat message handling error:', err);
      socket.emit('chat-error', { message: 'Failed to process message.' });
    }
  });

  // Handle live chat reaction toggle
  socket.on('react-chat-message', async (data) => {
    try {
      const { messageId, emoji } = data;
      const active = activeUsers.get(socket.id);
      if (!active || !emoji) return;

      // Strict ban check
      const user = await User.findById(active.id);
      if (!user || user.isBanned) {
        socket.emit('banned-redirect');
        socket.disconnect();
        return;
      }

      const message = await LiveChatMessage.findById(messageId);
      if (!message) return;

      if (!message.reactions) {
        message.reactions = new Map();
      }

      let usersList = message.reactions.get(emoji) || [];

      if (usersList.includes(active.browserToken)) {
        usersList = usersList.filter(token => token !== active.browserToken);
      } else {
        usersList.push(active.browserToken);
      }

      message.reactions.set(emoji, usersList);
      message.markModified('reactions');
      await message.save();

      const updatedMsg = await LiveChatMessage.findById(messageId).populate('sender', 'displayName');
      io.emit('chat-message-updated', updatedMsg);
    } catch (err) {
      console.error('Socket chat reaction error:', err);
    }
  });

  // Handle live chat message editing (sender-only, 5 min window)
  socket.on('edit-chat-message', async (data) => {
    try {
      const { messageId, text } = data;
      const active = activeUsers.get(socket.id);
      if (!active || !text) return;

      // Strict ban check
      const user = await User.findById(active.id);
      if (!user || user.isBanned) {
        socket.emit('banned-redirect');
        socket.disconnect();
        return;
      }

      if (user.mutedUntil && user.mutedUntil > new Date()) {
        return socket.emit('chat-error', { message: 'You are muted and cannot edit messages.' });
      }

      const message = await LiveChatMessage.findById(messageId);
      if (!message) return;

      // Auth check
      if (message.sender.toString() !== active.id.toString()) {
        return socket.emit('chat-error', { message: 'You can only edit your own messages.' });
      }

      // Check time window (5 minutes)
      const timeDiff = Date.now() - new Date(message.createdAt).getTime();
      if (timeDiff > 5 * 60 * 1000) {
        return socket.emit('chat-error', { message: 'Edit window (5 minutes) has expired.' });
      }

      if (text.length > 500) {
        return socket.emit('chat-error', { message: 'Message cannot exceed 500 characters.' });
      }

      const sanitizedText = filterProfanity(text.trim());
      message.text = sanitizedText;
      message.isEdited = true;
      await message.save();

      const updatedMsg = await LiveChatMessage.findById(messageId).populate('sender', 'displayName');
      io.emit('chat-message-updated', updatedMsg);
    } catch (err) {
      console.error('Socket message edit error:', err);
    }
  });

  // Handle live chat message deleting (sender-only, 5 min window)
  socket.on('delete-chat-message', async (messageId) => {
    try {
      const active = activeUsers.get(socket.id);
      if (!active) return;

      // Strict ban check
      const user = await User.findById(active.id);
      if (!user || user.isBanned) {
        socket.emit('banned-redirect');
        socket.disconnect();
        return;
      }

      const message = await LiveChatMessage.findById(messageId);
      if (!message) return;

      // Auth check
      if (message.sender.toString() !== active.id.toString()) {
        return socket.emit('chat-error', { message: 'You can only delete your own messages.' });
      }

      // Check time window (5 minutes)
      const timeDiff = Date.now() - new Date(message.createdAt).getTime();
      if (timeDiff > 5 * 60 * 1000) {
        return socket.emit('chat-error', { message: 'Delete window (5 minutes) has expired.' });
      }

      await LiveChatMessage.findByIdAndDelete(messageId);
      io.emit('message-deleted', messageId);

      const totalChatMessages = await LiveChatMessage.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalChatMessages });
    } catch (err) {
      console.error('Socket message delete error:', err);
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    const active = activeUsers.get(socket.id);
    if (active) {
      io.to('admin').emit('moderation-activity', {
        type: 'user_left',
        text: `🔴 ${active.displayName} disconnected`,
        timestamp: new Date()
      });
      io.emit('user-status-change', {
        userId: active.id,
        browserToken: active.browserToken,
        isOnline: false,
        lastActive: new Date()
      });
      activeUsers.delete(socket.id);
    }
    
    io.emit('online-count', io.sockets.sockets.size);
    io.to('admin').emit('admin-stats-update', { onlineUsers: io.sockets.sockets.size });
  });
});

// Start Server
server.listen(PORT, () => {
  logger.info(`DSEU Unfiltered server startup initiated. Running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
});

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  logger.warn(`Shutdown signal received (${signal}). Commencing graceful shutdown...`);
  
  // Close HTTP server and socket connection
  server.close(() => {
    logger.info('HTTP & Socket.IO server closed.');
    
    // Close database connection
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB database connection closed.');
      logger.warn('DSEU Unfiltered server shutdown completed.');
      process.exit(0);
    }).catch(err => {
      logger.error('Error closing MongoDB connection during shutdown', { error: err.message });
      process.exit(1);
    });
  });
  
  // Force shutdown after 10s if sockets are hanging
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing process exit...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
