import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-proxy-rate-test-secret';
process.env.NODE_ENV = 'test';

const [{ createApp }, { env }, { authAccountRateLimitKey }] = await Promise.all([
  import('../app.js'),
  import('../config/env.js'),
  import('../middleware/securityMiddleware.js')
]);

test('proxy trust is limited to the configured number of ingress hops', { concurrency: false }, () => {
  const oldHops = env.trustProxyHops;
  try {
    env.trustProxyHops = 1;
    const app = createApp({ databaseMiddleware: (_req, _res, next) => next() });
    const trust = app.get('trust proxy fn');
    assert.equal(app.get('trust proxy'), 1);
    assert.equal(trust('10.0.0.2', 0), true);
    assert.equal(trust('198.51.100.10', 1), false);
  } finally { env.trustProxyHops = oldHops; }
});

test('account rate-limit identifiers normalize email and do not retain plaintext addresses', () => {
  const normalized = authAccountRateLimitKey(' Student@SATIENGG.IN ');
  assert.equal(normalized, authAccountRateLimitKey('student@satiengg.in'));
  assert.notEqual(normalized, authAccountRateLimitKey('other@satiengg.in'));
  assert.equal(normalized.includes('@'), false);
});
