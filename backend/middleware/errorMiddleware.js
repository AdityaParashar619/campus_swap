import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const error = err && typeof err === 'object'
    ? err
    : { status: 500, message: 'Internal Server Error', originalValue: err };
  let status = error.status || error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let details = error.details || {};

  if (error.name === 'MulterError') {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'Each attachment must be 10 MB or smaller.' : 'Attachment upload exceeds the allowed file limits.';
  }

  if (status < 400 || status > 599) status = 500;
  if (error.name === 'ValidationError') status = 400;
  if (error.name === 'ValidationError') {
    details = Object.values(error.errors).reduce((acc, field) => {
      acc[field.path] = field.message;
      return acc;
    }, {});
  }

  if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern || {})[0];
    details = { field };
  }

  if (error.name === 'CastError') {
    status = 400;
    details = { field: error.path };
  }

  if (status >= 500 && env.nodeEnv === 'production' && error.expose !== true) {
    message = 'Internal Server Error';
    details = {};
  }

  res.status(status).json({
    success: false,
    status,
    message,
    requestId: req.requestId,
    ...(Object.keys(details).length ? { details } : {})
  });

  if (status >= 500) {
    const diagnostic = error instanceof Error
      ? error.stack || error.message || 'Error without stack or message'
      : `Non-Error rejection: ${JSON.stringify({ name: error.name, status: error.status, code: error.code, message: error.message })}`;
    console.error(`[${req.requestId || 'n/a'}]`, diagnostic || 'Unknown server error');
  } else if (env.nodeEnv === 'development') {
    console.warn(`[${req.requestId || 'n/a'}]`, message);
  }
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
