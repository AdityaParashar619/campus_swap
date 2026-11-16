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

export const app = createApp();
export const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });
io.use(socketAuthMiddleware);
io.engine.on('connection_error', (error) => {
  console.error(`Socket.IO connection failed: ${error.message}`);
});

app.locals.io = io;

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  socket.join(`user:${userId}`);
  io.to(`user:${userId}`).emit('presence:update', { userId, online: true });
  socket.on('disconnect', () => {
    io.to(`user:${userId}`).emit('presence:update', { userId, online: false });
  });

  socket.on('typing', ({ receiverId, isTyping } = {}) => {
    if (typeof receiverId === 'string' && receiverId.length <= 64) io.to(`user:${receiverId}`).emit('typing', { senderId: userId, isTyping: Boolean(isTyping) });
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
    console.error(`MongoDB connection failed: ${error.message}`);
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

  httpServer.listen(env.port, () => {
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
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);
    clearInterval(retryTimer);
    clearInterval(imageCleanupTimer);
    const closeHttpServer = () => httpServer.close(async (error) => {
      try {
        await mongoose.disconnect();
      } catch (dbError) {
        console.error(`Database shutdown failed: ${dbError.message}`);
      }
      if (error) {
        console.error(`HTTP shutdown failed: ${error.message}`);
        process.exitCode = 1;
      }
    });
    if (httpServer.listening) io.close(closeHttpServer);
    else void mongoose.disconnect();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return httpServer;
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startServer();
}
