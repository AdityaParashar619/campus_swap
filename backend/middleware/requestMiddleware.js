const maskAuthHeader = (value = '') => {
  if (!value.startsWith('Bearer ')) return value;
  return 'Bearer ***';
};

export const requestMetaMiddleware = (req, res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('x-request-id', req.requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const authHeader = maskAuthHeader(req.headers.authorization || '');
    const base = `[${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`;

    if (req.method === 'GET') {
      console.log(base);
      return;
    }

    console.log(`${base} auth=${authHeader ? 'yes' : 'no'}`);
  });

  next();
};
