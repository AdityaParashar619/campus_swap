const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

const normalizeTarget = (value) => {
  if (!value) return '';
  return value.replace(/\/+$/, '');
};

const getTargetBaseUrl = () =>
  normalizeTarget(process.env.API_PROXY_TARGET || process.env.VITE_API_BASE_URL);

const copyHeaders = (headers) => {
  const nextHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      nextHeaders[key] = value;
    }
  }

  return nextHeaders;
};

const getRequestBody = (req) => {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  if (req.body === undefined || req.body === null) return undefined;
  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
};

export default async function handler(req, res) {
  const targetBaseUrl = getTargetBaseUrl();

  if (!targetBaseUrl) {
    return res.status(500).json({
      success: false,
      message: 'API proxy is not configured. Set API_PROXY_TARGET to your deployed backend /api URL.'
    });
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
  const query = new URLSearchParams(
    Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .flatMap(([key, value]) =>
        Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value]]
      )
  );
  const url = `${targetBaseUrl}/${path}${query.size ? `?${query.toString()}` : ''}`;

  try {
    const upstreamResponse = await fetch(url, {
      method: req.method,
      headers: copyHeaders(req.headers),
      body: getRequestBody(req)
    });

    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(upstreamResponse.status).send(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    res.status(502).json({
      success: false,
      message: 'Unable to reach the backend API.',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
}
