// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Default error response
  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';
  let details = {};

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).reduce((acc, field) => {
      acc[field.path] = field.message;
      return acc;
    }, {});
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  // MongoDB cast error
  if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  }

  res.status(status).json({
    success: false,
    status,
    message,
    ...(Object.keys(details).length > 0 && { details })
  });
};

// Async handler wrapper to catch errors in async controllers
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
