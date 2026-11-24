import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const runNode = promisify(execFile);

async function checkOrigins(environment, allowed, rejected) {
  await runNode(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createApp } from './app.js';
    const [allowed, rejected] = JSON.parse(process.argv[1]);
    const server = createApp({ databaseMiddleware: (_req, _res, next) => next() }).listen(0, '127.0.0.1');
    try {
      await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
      const base = 'http://127.0.0.1:' + server.address().port;
      for (const origin of allowed) {
        const preflight = await fetch(base + '/api/auth/login', {
          method: 'OPTIONS',
          headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' }
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
        assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
        const refresh = await fetch(base + '/api/auth/refresh', { method: 'POST', headers: { origin } });
        assert.equal(refresh.status, 401, 'Trusted origin should reach the no-session check');
        assert.equal(refresh.headers.get('access-control-allow-origin'), origin);
      }
      for (const origin of rejected) {
        const response = await fetch(base + '/api/live', { headers: { origin } });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
      for (const path of ['/api/auth/refresh', '/api/auth/logout']) {
        const noOrigin = await fetch(base + path, { method: 'POST' });
        assert.equal(noOrigin.status, 403);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }`, JSON.stringify([allowed, rejected])], {
    cwd: new URL('..', import.meta.url),
    // The subprocess includes a cold module load while other integration tests run.
    timeout: 45000,
    env: {
      ...process.env,
      JWT_SECRET: 'isolated-cors-jwt-secret'.repeat(2),
      OTP_PEPPER: 'isolated-cors-otp-pepper'.repeat(2),
      NODE_ENV: environment,
      FRONTEND_URL: environment === 'production' ? 'https://web.example, https://admin.example' : 'http://localhost:8080',
      MONGO_URI: 'mongodb://database.example:27017/campusswap',
      TRUST_PROXY_HOPS: '1',
      CLOUDINARY_CLOUD_NAME: 'fixture-cloud',
      CLOUDINARY_API_KEY: 'fixture-key',
      CLOUDINARY_API_SECRET: 'fixture-secret',
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'CampusSwap <no-reply@satiengg.in>',
      RESEND_API_KEY: 're_fixture',
      RESEND_DOMAIN_VERIFIED: 'true',
      RESEND_TEST_MODE: 'false',
      OTP_MOCK_ENABLED: 'false',
      ADMIN_BOOTSTRAP_ENABLED: 'false',
      PILOT_MODE_ENABLED: 'false'
    }
  });
}

test('development admits the configured Docker origin with credentials', () =>
  checkOrigins('development', ['http://localhost:8080'], []));

test('development admits the Vite origin for preflight and cookie-auth routes', () =>
  checkOrigins('development', ['http://localhost:5173'], []));

test('development rejects unknown origins and lookalike hosts', () =>
  checkOrigins('development', [], ['https://unknown.example', 'http://localhost:5173.unknown.example']));

test('production keeps configured HTTPS origins only', () =>
  checkOrigins('production', ['https://web.example', 'https://admin.example'],
    ['http://localhost:8080', 'http://localhost:5173', 'https://unknown.example']));
