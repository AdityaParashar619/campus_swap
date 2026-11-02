import { isDatabaseReady } from '../config/db.js';

export const requireDatabase = (req, res, next) => {
  if (isDatabaseReady()) return next();

  res.status(503).json({
    success: false,
    status: 503,
    message: 'Database is temporarily unavailable. Please retry shortly.',
    requestId: req.requestId
  });
};
