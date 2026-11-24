import { randomUUID } from 'node:crypto';

export const requestMetaMiddleware = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    // Route templates come from code. Raw URLs and headers can carry credentials.
    const route = typeof req.route?.path === 'string' ? req.route.path : '(unmatched)';
    console.log(`[${req.requestId}] ${req.method} ${route} ${res.statusCode} ${durationMs}ms`);
  });

  next();
};
