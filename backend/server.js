import { createServer } from 'http';
import { pathToFileURL } from 'url';
import { Server } from 'socket.io';
import { createApp, corsOptions } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { ensureAdminUser } from './scripts/ensureAdmin.js';
import { seedDatabase } from './scripts/seed.js';

export const app = createApp();
export const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

app.locals.io = io;

io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      io.to(`user:${userId}`).emit('presence:update', { userId, online: true });
    }
  });

  socket.on('typing', ({ receiverId, senderId, isTyping }) => {
    if (receiverId) io.to(`user:${receiverId}`).emit('typing', { senderId, isTyping });
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

  setInterval(() => void connectDatabaseInBackground(), env.databaseRetryIntervalMs).unref();
  return httpServer;
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startServer();
}
