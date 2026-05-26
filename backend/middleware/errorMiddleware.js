import { env } from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  let details = err.details || {};

  if (err.name === 'ValidationError') {
    details = Object.values(err.errors).reduce((acc, field) => {
      acc[field.path] = field.message;
      return acc;
    }, {});
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    details = { field };
  }

  res.status(status).json({
    success: false,
    status,
    message,
    requestId: req.requestId,
    ...(Object.keys(details).length ? { details } : {})
  });

  if (status >= 500) {
    console.error(`[${req.requestId || 'n/a'}]`, err.stack || err.message);
  } else if (env.nodeEnv === 'development') {
    console.warn(`[${req.requestId || 'n/a'}]`, message);
  }
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
