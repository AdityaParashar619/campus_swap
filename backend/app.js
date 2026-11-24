import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDatabaseReady } from './config/db.js';
import { env } from './config/env.js';
import { requireDatabase } from './middleware/databaseMiddleware.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { requestMetaMiddleware } from './middleware/requestMiddleware.js';
import { securityMiddleware } from './middleware/securityMiddleware.js';
import adminRoutes from './routes/adminRoutes.js';
import academicRoutes from './routes/academicRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bountyRoutes from './routes/bountyRoutes.js';
import connectionRoutes from './routes/connectionRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import noticeRoutes from './routes/noticeRoutes.js';
import campusLocationRoutes from './routes/campusLocationRoutes.js';
import campusIssueRoutes from './routes/campusIssueRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import { Forbidden } from './utils/AppError.js';

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Forbidden('Origin is not allowed by CORS'));
  },
  credentials: true
};

export const createApp = ({ databaseMiddleware = requireDatabase } = {}) => {
  const app = express();
  app.set('trust proxy', env.trustProxyHops);

  app.use(requestMetaMiddleware);
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
  app.use(securityMiddleware);

  const healthHandler = (_req, res) => {
    const databaseReady = isDatabaseReady();
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
  app.use('/api/academic', academicRoutes);
  app.use('/api/listings', listingRoutes);
  app.use('/api/bounties', bountyRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/connections', connectionRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/notices', noticeRoutes);
  app.use('/api/campus-locations', campusLocationRoutes);
  app.use('/api/campus-issues', campusIssueRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/admin', adminRoutes);

  if (env.serveFrontend) {
    const frontend = fileURLToPath(new URL('./public/', import.meta.url));
    if (!existsSync(new URL('./public/index.html', import.meta.url))) {
      throw new Error('Same-origin serving requires the built frontend in backend/public');
    }

    const assets = fileURLToPath(new URL('./public/assets/', import.meta.url));
    const staticFrontend = express.static(frontend, {
      index: false, redirect: false,
      setHeaders(res, file) {
        if (file.startsWith(assets)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        else if (file.endsWith('index.html')) res.set('Cache-Control', 'no-cache');
      }
    });
    app.use((req, res, next) => {
      if (/^\/(?:api|socket\.io)(?:\/|$)/i.test(req.path)) return next();
      staticFrontend(req, res, next);
    });
    app.get('*', (req, res, next) => {
      if (/^\/(?:api|socket\.io|assets)(?:\/|$)/i.test(req.path) || !req.accepts('html')) return next();
      res.set('Cache-Control', 'no-cache').sendFile('index.html', { root: frontend });
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Endpoint not found' });
  });
  app.use(errorHandler);

  return app;
};
