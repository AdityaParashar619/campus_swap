import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';
import { seedDatabase } from './scripts/seed.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import bountyRoutes from './routes/bountyRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

dotenv.config();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect DB and seed
(async () => {
  await connectDB();
  await seedDatabase();
})();

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/bounties', bountyRoutes);
app.use('/api/messages', messageRoutes);

// Socket.io setup
const userSockets = {}; // Map userId to socketId

io.on('connection', (socket) => {
  console.log('✓ User connected:', socket.id);

  // Register user socket
  socket.on('register', (userId) => {
    userSockets[userId] = socket.id;
    console.log('✓ User registered:', userId);
  });

  // Handle incoming messages
  socket.on('sendMessage', (message) => {
    const receiverSocketId = userSockets[message.receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receiveMessage', message);
    }
  });

  socket.on('disconnect', () => {
    // Remove user from map
    for (const [userId, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) {
        delete userSockets[userId];
        break;
      }
    }
    console.log('✗ User disconnected:', socket.id);
  });
});

// Store io in app for use in routes
app.locals.io = io;

// 404 handler - must be before error handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler - must be last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
