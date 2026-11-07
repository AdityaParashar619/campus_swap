import { createServer } from 'http';
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { createApp, corsOptions } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { ensureAdminUser } from './scripts/ensureAdmin.js';
import { seedDatabase } from './scripts/seed.js';
import User from './models/User.js';

export const app = createApp();
export const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });
io.use(async (socket, next) => {
  try {
    const decoded = jwt.verify(socket.handshake.auth?.token || '', env.jwtSecret);
    const user = await User.findById(decoded.userId).select('_id accountStatus isBlocked tokenVersion emailVerified');
    if (!user || user.isBlocked || ['pending', 'suspended', 'blocked'].includes(user.accountStatus) || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) return next(new Error('Unauthorized'));
    socket.data.userId = user._id.toString();
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});
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
const connectDatabaseInBackground = async () => {
  if (connecting) return;
  connecting = true;

  try {
    await connectDB();
    if (env.seedOnStartup) await seedDatabase();
    await ensureAdminUser();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
  } finally {
    connecting = false;
  }
};

export const startServer = () => {
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

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);
    clearInterval(retryTimer);
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
