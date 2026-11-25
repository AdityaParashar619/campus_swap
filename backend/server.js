import { createServer } from 'http';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createApp, corsOptions } from './app.js';
import { connectDB, isDatabaseReady } from './config/db.js';
import { env } from './config/env.js';
import { ensureAdminUser } from './scripts/ensureAdmin.js';
import { seedDatabase } from './scripts/seed.js';
import User from './models/User.js';
import { socketAuthMiddleware } from './middleware/socketAuthMiddleware.js';
import { verifyEmailProviderConnection } from './utils/emailProvider.js';
import { cleanupExpiredProductImages } from './services/productImageService.js';
import { areUsersConnected } from './utils/connections.js';

export const app = createApp();
export const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });
io.use(socketAuthMiddleware);
io.engine.on('connection_error', () => {
  console.error('Socket.IO connection failed');
});

app.locals.io = io;

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  const tokenTimer = socket.data.tokenExpiresAt
    ? setTimeout(() => {
      socket.emit('session:expired');
      socket.disconnect(true);
    }, Math.max(0, socket.data.tokenExpiresAt - Date.now()))
    : null;
  tokenTimer?.unref?.();
  socket.join(`user:${userId}`);
  io.to(`user:${userId}`).emit('presence:update', { userId, online: true });
  socket.on('disconnect', () => {
    if (tokenTimer) clearTimeout(tokenTimer);
    io.to(`user:${userId}`).emit('presence:update', { userId, online: false });
  });

  let lastTypingAt = 0;
  socket.on('typing', async ({ receiverId, isTyping } = {}) => {
    if (typeof receiverId !== 'string' || !mongoose.isValidObjectId(receiverId) || receiverId === userId || typeof isTyping !== 'boolean') return;
    const now = Date.now();
    if (now - lastTypingAt < 250) return;
    lastTypingAt = now;
    try {
      if (await areUsersConnected(userId, receiverId)) {
        io.to(`user:${receiverId}`).emit('typing', { senderId: userId, isTyping });
      }
    } catch {
      // Ignore transient authorization lookup failures; never deliver unverified events.
    }
  });
});

let connecting = false;
export const connectDatabaseInBackground = async () => {
  if (connecting || isDatabaseReady()) return;
  connecting = true;

  try {
    await connectDB();
    if (env.seedOnStartup) await seedDatabase();
    await ensureAdminUser();
    void cleanupExpiredProductImages().catch(() => console.error('Product image cleanup could not complete.'));
  } catch (error) {
    console.error(env.nodeEnv === 'production' ? 'MongoDB startup checks failed; see index verification and readiness status.' : `MongoDB connection failed: ${error.message}`);
  } finally {
    connecting = false;
  }
};

export const startServer = () => {
  if (env.emailProvider === 'gmail') {
    void verifyEmailProviderConnection().catch(() => console.error('Gmail SMTP connection verification failed; email delivery will remain unavailable until configuration is corrected.'));
  }
  httpServer.on('error', (error) => {
    console.error(`HTTP server failed: ${error.message}`);
    process.exitCode = 1;
  });

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(`Server running on port ${env.port}`);
    void connectDatabaseInBackground();
  });

  const retryTimer = setInterval(() => void connectDatabaseInBackground(), env.databaseRetryIntervalMs);
  retryTimer.unref();
  const imageCleanupTimer = setInterval(() => {
    if (isDatabaseReady()) void cleanupExpiredProductImages().catch(() => console.error('Product image cleanup could not complete.'));
  }, 60 * 60 * 1000);
  imageCleanupTimer.unref();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);
    clearInterval(retryTimer);
    clearInterval(imageCleanupTimer);
    // Socket.IO also owns the attached HTTP server's close.
    try {
      await io.close((error) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
          console.error('HTTP shutdown failed');
          process.exitCode = 1;
        }
      });
    } catch {
      console.error('Socket.IO shutdown failed');
      process.exitCode = 1;
    }
    try {
      await mongoose.disconnect();
    } catch {
      console.error('Database shutdown failed');
      process.exitCode = 1;
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return httpServer;
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startServer();
}
