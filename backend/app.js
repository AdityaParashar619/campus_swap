import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { requireDatabase } from './middleware/databaseMiddleware.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { requestMetaMiddleware } from './middleware/requestMiddleware.js';
import { securityMiddleware } from './middleware/securityMiddleware.js';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bountyRoutes from './routes/bountyRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import requestRoutes from './routes/requestRoutes.js';

const allowedOrigins = env.frontendUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
};

export const createApp = ({ databaseMiddleware = requireDatabase } = {}) => {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    try {
      req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
        const separator = part.indexOf('=');
        const key = separator < 0 ? part : part.slice(0, separator);
        const value = separator < 0 ? '' : part.slice(separator + 1);
        return [decodeURIComponent(key), decodeURIComponent(value)];
      }));
      next();
    } catch {
      req.cookies = {};
      next();
    }
  });
  app.use(requestMetaMiddleware);
  app.use(securityMiddleware);

  const healthHandler = (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
      success: databaseReady,
      status: databaseReady ? 'OK' : 'DEGRADED',
      database: databaseReady ? 'connected' : 'disconnected',
      env: env.nodeEnv
    });
  };

  const liveHandler = (_req, res) => res.status(200).json({ success: true, status: 'OK' });
  app.get('/live', liveHandler);
  app.get('/api/live', liveHandler);
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api', databaseMiddleware);
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

  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Endpoint not found: ${req.originalUrl}` });
  });
  app.use(errorHandler);

  return app;
};
