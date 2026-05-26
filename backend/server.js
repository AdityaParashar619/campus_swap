import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { requestMetaMiddleware } from './middleware/requestMiddleware.js';
import { securityMiddleware } from './middleware/securityMiddleware.js';
import { ensureAdminUser } from './scripts/ensureAdmin.js';
import { seedDatabase } from './scripts/seed.js';
import authRoutes from './routes/authRoutes.js';
import bountyRoutes from './routes/bountyRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: env.frontendUrl,
    credentials: true
  }
});

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(requestMetaMiddleware);
app.use(securityMiddleware);

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'OK', env: env.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/bounties', bountyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/admin', adminRoutes);

io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      io.to(`user:${userId}`).emit('presence:update', { userId, online: true });
    }
  });

  socket.on('typing', ({ receiverId, senderId, isTyping }) => {
    if (receiverId) {
      io.to(`user:${receiverId}`).emit('typing', { senderId, isTyping });
    }
  });

  // Messages are persisted and authorized through the REST API before the server broadcasts them.
});

app.locals.io = io;

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint not found: ${req.originalUrl}` });
});

app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  if (env.seedOnStartup) {
    await seedDatabase();
  }

  await ensureAdminUser();

  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.port} is already in use. Stop the existing process or set PORT to a free port in backend/.env.`);
      process.exit(1);
    }

    console.error('HTTP server failed:', error.message);
    process.exit(1);
  });

  httpServer.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error('Server failed to start:', error.message);
  process.exit(1);
});
