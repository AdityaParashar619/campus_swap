import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-dev-mail-route-test-secret';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';

const [{ createApp }, { env }, { captureDevelopmentMail }] = await Promise.all([
  import('../app.js'),
  import('../config/env.js'),
  import('../utils/devMailCapture.js')
]);

test('development mail preview requires a one-use capability and is unavailable outside mock development', { concurrency: false }, async () => {
  const original = { nodeEnv: env.nodeEnv, otpMockEnabled: env.otpMockEnabled };
  env.nodeEnv = 'development';
  env.otpMockEnabled = true;
  const capability = captureDevelopmentMail({ to: 'student@satiengg.in', purpose: 'student-verification', code: '123456' });
  const server = createServer(createApp({ databaseMiddleware: (_req, _res, next) => next() }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const endpoint = `http://127.0.0.1:${server.address().port}/api/auth/dev-mail-preview`;

  try {
    const request = () => fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewToken: capability.previewToken })
    });
    const first = await request();
    const body = await first.json();
    assert.equal(first.status, 200);
    assert.equal(body.code, '123456');
    assert.equal(body.to, undefined);
    assert.match(first.headers.get('cache-control'), /no-store/);
    assert.equal((await request()).status, 400);

    const productionCapability = captureDevelopmentMail({ to: 'other@satiengg.in', purpose: 'reset', url: 'http://localhost/reset#token=test-token' });
    env.nodeEnv = 'production';
    const blocked = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewToken: productionCapability.previewToken })
    });
    assert.equal(blocked.status, 400);
  } finally {
    env.nodeEnv = original.nodeEnv;
    env.otpMockEnabled = original.otpMockEnabled;
    await new Promise((resolve) => server.close(resolve));
  }
});
