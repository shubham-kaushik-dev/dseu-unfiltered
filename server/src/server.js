import express from 'express';
import dns from 'dns';
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
import { v2 as cloudinary } from 'cloudinary';
import { checkMaintenance } from './middleware/maintenance.js';
import { initBackupScheduler } from './utils/backup.js';
import { logger } from './utils/logger.js';

// Routes
import authRouter from './routes/auth.js';
import confessionsRouter from './routes/confessions.js';
import memesRouter from './routes/memes.js';
import pollsRouter from './routes/polls.js';
import adminRouter from './routes/admin.js';
import supportRouter from './routes/support.js';
import publicSettingsRouter from './routes/publicSettings.js';

// Models & Utils
import User from './models/User.js';
import LiveChatMessage from './models/LiveChatMessage.js';
import Confession from './models/Confession.js';
import Meme from './models/Meme.js';
import Poll from './models/Poll.js';
import Settings from './models/Settings.js';
import SupportMessage from './models/SupportMessage.js';
import PinnedMessage from './models/PinnedMessage.js';
import { seedDatabase } from './utils/seeder.js';
import { filterProfanity } from './utils/profanity.js';

const app = express();
const PORT = process.env.PORT || 5000;

const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

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
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "http:", "https:", "https://api.dicebear.com"],
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
const isVercelEnv = process.env.VERCEL === '1';
if (!isVercelEnv && !fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    logger.warn('Failed to create uploads directory on boot:', { error: err.message });
  }
}
app.use('/uploads', express.static(uploadsDir));

import { parseUser } from './middleware/auth.js';

// Maintenance Mode middleware interceptor
app.use(checkMaintenance);

// Attach API Routes
app.use('/api', publicSettingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/confessions', confessionsRouter);
app.use('/api/memes', memesRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);

// Fetch chat history (latest 50 messages chronologically)
app.get('/api/chat', parseUser, async (req, res) => {
  try {
    const isUserAdmin = req.user?.role === 'admin' || req.user?.role === 'sub-admin' || req.user?.role === 'sub_admin';
    const query = { status: { $ne: 'trash' } };

    if (!isUserAdmin) {
      // Filter out shadow-banned messages unless sent by the user
      query.$or = [
        { isShadowBanned: { $ne: true } },
        { sender: req.user?._id }
      ];
    }

    const messages = await LiveChatMessage.find(query)
      .populate('sender', 'displayName role')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'displayName role' }
      })
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
    origin: '*', 
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

// Local in-memory state for sockets
const activeUsers = new Map(); // socket.id -> { id, displayName, browserToken, isBanned, role }
app.set('activeUsers', activeUsers);
const lastMessageTimes = new Map(); // browserToken -> timestamp

// Helper to calculate online count respecting Stealth Mode
const getOnlineCount = async () => {
  let count = io.sockets.sockets.size;
  
  // Check if stealth mode is ON
  const stealthSetting = await Settings.findOne({ key: 'stealth_mode' });
  const isStealth = stealthSetting ? stealthSetting.value : false;

  if (isStealth) {
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      const activeSocks = Array.from(activeUsers.values());
      const hasAdmin = activeSocks.some(u => u.browserToken === adminUser.browserToken);
      if (hasAdmin) {
        count = Math.max(0, count - 1);
      }
    }
  }
  return count;
};

// Configure public DNS resolvers to prevent local environment querySrv ECONNREFUSED issues on SRV lookups
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  logger.info('Global DNS servers configured successfully to public DNS servers.');
} catch (e) {
  logger.warn('Failed to set global DNS servers, relying on default system resolver.', { error: e.message });
}

// Global database connection
logger.info('Connecting to MongoDB...');
const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dseu_unfiltered';

async function connectWithRetry(uri, retries = 5, delay = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Database connection attempt ${attempt}/${retries}...`);
      await mongoose.connect(uri);
      logger.info(`MongoDB Connected successfully to ${uri.startsWith('mongodb+srv') ? 'Atlas Database' : 'Local Database'}.`);
      return true;
    } catch (err) {
      logger.error(`Database connection attempt ${attempt} failed: ${err.message}`);
      if (attempt === retries) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

connectWithRetry(dbUri)
  .then(async () => {
    await seedDatabase();
    initBackupScheduler();
    initTrashCleanupScheduler();
    startHttpServer();
  })
  .catch(async (err) => {
    logger.error('All connection attempts to primary database failed. Falling back to local MongoDB connection...', { error: err.message });
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/dseu_unfiltered');
      logger.info('MongoDB Connected successfully to Local Fallback Database.');
      await seedDatabase();
      initBackupScheduler();
      initTrashCleanupScheduler();
      startHttpServer();
    } catch (localErr) {
      logger.error('Local database fallback connection failed as well.', { error: localErr.message });
      // Start server anyway so status and error details can be inspected on endpoints
      startHttpServer();
    }
  });

// Socket.IO event handler
io.on('connection', async (socket) => {
  socket.join('public-chat');

  // Trigger counts updates
  io.emit('online-count', await getOnlineCount());
  io.to('admin').emit('admin-stats-update', { onlineUsers: io.sockets.sockets.size });

  // Handle client register identity mapping
  socket.on('register-identity', async (token) => {
    try {
      if (!token) return;

      const user = await User.findOne({ browserToken: token });
      if (user) {
        if (user.isBanned) {
          // Banned user: join support room, do not join public chat
          socket.leave('public-chat');
          socket.join(`support-${token}`);
          
          activeUsers.set(socket.id, {
            id: user._id,
            displayName: user.displayName,
            browserToken: token,
            isBanned: true,
            role: user.role
          });
          
          socket.emit('banned-user-info', {
            displayName: user.displayName,
            reason: user.banReason || 'Violated DSEU Unfiltered community guidelines',
            bannedBy: user.bannedBy || 'Professor',
            banDate: user.banDate || user.updatedAt
          });
          return;
        }

        socket.join(`support-${token}`);
        socket.join('public-chat');

        activeUsers.set(socket.id, {
          id: user._id,
          displayName: user.displayName,
          browserToken: token,
          isBanned: false,
          role: user.role
        });

        // If admin joins: notify admin channel, broadcast online status recalculation
        if (user.role === 'admin' || user.role === 'sub-admin' || user.role === 'sub_admin') {
          socket.join('admin');
          io.emit('online-stealth-update');
        }

        // Broadcast status change
        io.emit('user-status-change', {
          userId: user._id,
          browserToken: token,
          isOnline: true,
          lastActive: user.lastActive
        });

        io.to('admin').emit('moderation-activity', {
          type: 'user_joined',
          text: `🟢 ${user.displayName} connected to community`,
          timestamp: new Date()
        });

        // Trigger counts recalculation
        io.emit('online-count', await getOnlineCount());
      } else {
        // Token not found (fresh moniker generation will follow via /me API trigger)
        // Send register notify to reload lists on admin dashboard
        io.to('admin').emit('new-user-registered');
      }
    } catch (err) {
      console.error('Socket identity registration error:', err);
    }
  });

  socket.on('admin-join', () => {
    socket.join('admin');
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const active = activeUsers.get(socket.id);
    if (!active || active.isBanned) return;

    socket.to('public-chat').emit('user-typing', {
      displayName: active.displayName,
      isTyping: data.isTyping
    });
  });

  // Handle live chat messages
  socket.on('send-chat-message', async (data) => {
    try {
      const active = activeUsers.get(socket.id);
      if (!active) {
        return socket.emit('chat-error', { message: 'Register your identity first.' });
      }

      const user = await User.findById(active.id);
      if (!user || user.isBanned) {
        return socket.emit('chat-error', { message: 'Your identity is banned.' });
      }

      if (user.mustChangePassword) {
        return socket.emit('chat-error', { message: 'You must change your password immediately after logging in.' });
      }

      if (user.mutedUntil && user.mutedUntil > new Date()) {
        const remaining = Math.ceil((user.mutedUntil - new Date()) / 1000 / 60);
        return socket.emit('chat-error', { message: `You are muted. Try again in ${remaining} minutes.` });
      }

      let text = '';
      let replyTo = null;
      let messageType = 'normal';

      if (typeof data === 'string') {
        text = data;
      } else if (data && typeof data === 'object') {
        text = data.text;
        replyTo = data.replyTo || null;
        messageType = data.messageType || 'normal';
      }

      if (!text || typeof text !== 'string' || text.trim() === '') {
        return socket.emit('chat-error', { message: 'Message content cannot be empty.' });
      }

      if (text.length > 500) {
        return socket.emit('chat-error', { message: 'Message is too long (max 500 chars).' });
      }

      // Enforce slow-mode for normal users
      if (user.role !== 'admin') {
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
        lastMessageTimes.set(active.browserToken, Date.now());
      }

      const sanitizedText = filterProfanity(text.trim());

      const chatMsg = await LiveChatMessage.create({
        text: sanitizedText,
        sender: active.id,
        campus: user.campus || 'DSEU',
        replyTo: replyTo,
        messageType: (user.role === 'admin' || user.role === 'sub-admin' || user.role === 'sub_admin') ? messageType : 'normal',
        isShadowBanned: user.isShadowBanned || false,
        reactions: new Map([
          ['❤️', []],
          ['😂', []],
          ['🔥', []]
        ])
      });

      const populatedMsg = await LiveChatMessage.findById(chatMsg._id)
        .populate('sender', 'displayName role')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'displayName role' }
        });

      // Shadow-ban logic: Echo ONLY to sender's socket, and admin room
      if (user.isShadowBanned) {
        socket.emit('new-chat-message', populatedMsg);
        io.to('admin').emit('new-chat-message', populatedMsg);
        io.to('admin').emit('moderation-activity', {
          type: 'chat_sent',
          text: `[SHADOW BANNED] Message from ${active.displayName}: "${sanitizedText.substring(0, 30)}..."`,
          timestamp: new Date()
        });
      } else {
        io.emit('new-chat-message', populatedMsg);
        io.to('admin').emit('moderation-activity', {
          type: 'chat_sent',
          text: `Message from ${active.displayName}: "${sanitizedText.substring(0, 30)}..."`,
          timestamp: new Date()
        });
      }

      const totalChatMessages = await LiveChatMessage.countDocuments();
      io.to('admin').emit('admin-stats-update', { totalChatMessages });

    } catch (err) {
      console.error('Socket chat message handling error:', err);
      socket.emit('chat-error', { message: 'Failed to process message.' });
    }
  });

  // Handle reactions
  socket.on('react-chat-message', async (data) => {
    try {
      const { messageId, emoji } = data;
      const active = activeUsers.get(socket.id);
      if (!active || !emoji) return;

      const user = await User.findById(active.id);
      if (!user || user.isBanned) return;

      const message = await LiveChatMessage.findById(messageId);
      if (!message || message.status === 'trash') return;

      let usersList = message.reactions.get(emoji) || [];

      if (usersList.includes(active.browserToken)) {
        usersList = usersList.filter(token => token !== active.browserToken);
      } else {
        usersList.push(active.browserToken);
      }

      message.reactions.set(emoji, usersList);
      message.markModified('reactions');
      await message.save();

      const updatedMsg = await LiveChatMessage.findById(messageId)
        .populate('sender', 'displayName role')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'displayName role' }
        });
      io.emit('chat-message-updated', updatedMsg);
    } catch (err) {
      console.error('Socket chat reaction error:', err);
    }
  });

  // Support Chat Socket events
  socket.on('support-typing', (data) => {
    const active = activeUsers.get(socket.id);
    if (!active) return;

    if (active.role === 'admin' || active.role === 'sub-admin' || active.role === 'sub_admin') {
      io.to(`support-${data.token}`).emit('support-admin-typing', {
        isTyping: data.isTyping,
        adminName: active.displayName === 'Berlin' ? 'Berlin' : 'Professor'
      });
    } else {
      io.to('admin').emit('support-user-typing', {
        browserToken: active.browserToken,
        isTyping: data.isTyping
      });
    }
  });

  socket.on('support-seen', async (data) => {
    const active = activeUsers.get(socket.id);
    if (!active) return;

    if (active.role === 'admin' || active.role === 'sub-admin' || active.role === 'sub_admin') {
      const token = data?.token;
      if (!token) return;
      await SupportMessage.updateMany(
        { browserToken: token, senderType: 'user', isSeen: false },
        { $set: { isSeen: true } }
      );
      io.to(`support-${token}`).emit('support-messages-seen');
    } else {
      await SupportMessage.updateMany(
        { browserToken: active.browserToken, senderType: 'admin', isSeen: false },
        { $set: { isSeen: true } }
      );
      io.to('admin').emit('support-messages-seen', { token: active.browserToken });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', async () => {
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

      if (active.role === 'admin' || active.role === 'sub-admin' || active.role === 'sub_admin') {
        io.emit('online-stealth-update');
      }
    }
    
    io.emit('online-count', await getOnlineCount());
    io.to('admin').emit('admin-stats-update', { onlineUsers: io.sockets.sockets.size });
  });
});

// Background Task: Daily soft-deleted trash items cleanup (older than 30 days)
const cleanupTrash = async () => {
  try {
    const expiryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const deletedMessages = await LiveChatMessage.deleteMany({ status: 'trash', deletedAt: { $lte: expiryDate } });
    const deletedConfessions = await Confession.deleteMany({ status: 'trash', deletedAt: { $lte: expiryDate } });
    const deletedPolls = await Poll.deleteMany({ status: 'trash', deletedAt: { $lte: expiryDate } });

    // Memes require deleting Cloudinary assets
    const expiredMemes = await Meme.find({ status: 'trash', deletedAt: { $lte: expiryDate } });
    for (const m of expiredMemes) {
      const publicId = m.publicId || m.cloudinaryPublicId;
      if (publicId && isCloudinaryConfigured()) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Cloudinary destroy failure during trash cleanup:', err);
        }
      }
    }
    const deletedMemes = await Meme.deleteMany({ status: 'trash', deletedAt: { $lte: expiryDate } });

    logger.info('Completed scheduled trash cleanup task.', {
      messagesDeletedCount: deletedMessages.deletedCount,
      confessionsDeletedCount: deletedConfessions.deletedCount,
      memesDeletedCount: deletedMemes.deletedCount,
      pollsDeletedCount: deletedPolls.deletedCount
    });
  } catch (err) {
    logger.error('Error running daily soft-delete trash cleanup task:', err);
  }
};

// Expose scheduler to run after connection is established
export function initTrashCleanupScheduler() {
  cleanupTrash();
  setInterval(cleanupTrash, 24 * 60 * 60 * 1000);
}

// Start Server helper
export function startHttpServer() {
  if (!server.listening) {
    server.listen(PORT, () => {
      logger.info(`DSEU Unfiltered server startup initiated. Running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  }
}

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  logger.warn(`Shutdown signal received (${signal}). Commencing graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP & Socket.IO server closed.');
    mongoose.connection.close(false).then(() => {
      logger.info('MongoDB database connection closed.');
      logger.warn('DSEU Unfiltered server shutdown completed.');
      process.exit(0);
    }).catch(err => {
      logger.error('Error closing MongoDB connection during shutdown', { error: err.message });
      process.exit(1);
    });
  });
  
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing process exit...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server };
export default app;
