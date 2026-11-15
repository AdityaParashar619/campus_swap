import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-refresh-limiter-test-secret';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.RATE_LIMIT_MAX = '1000';

const [{ createApp }, { default: RefreshSession }, { default: User }] = await Promise.all([
  import('../app.js'),
  import('../models/RefreshSession.js'),
  import('../models/User.js')
]);

test('missing refresh cookies do not consume the login bucket; invalid cookies remain bounded separately', { concurrency: false }, async () => {
  const originals = {
    sessionFindOneAndUpdate: RefreshSession.findOneAndUpdate,
    sessionFindOne: RefreshSession.findOne,
    userFindOne: User.findOne
  };
  RefreshSession.findOneAndUpdate = async () => null;
  RefreshSession.findOne = async () => null;
  User.findOne = async () => null;
  const server = createServer(createApp({ databaseMiddleware: (_req, _res, next) => next() }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = async (path, { cookie, body } = {}) => {
    const headers = { origin: 'http://localhost:5173' };
    if (cookie) headers.cookie = cookie;
    if (body) headers['content-type'] = 'application/json';
    return fetch(`${base}${path}`, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
  };

  try {
    for (let index = 0; index < 12; index += 1) {
      const response = await post('/refresh');
      assert.equal(response.status, 401, `missing-cookie refresh ${index + 1}`);
    }

    for (let index = 0; index < 10; index += 1) {
      const response = await post('/refresh', { cookie: 'refreshToken=invalid-token' });
      assert.equal(response.status, 401, `invalid-cookie refresh ${index + 1}`);
    }
    const limitedRefresh = await post('/refresh', { cookie: 'refreshToken=invalid-token' });
    assert.equal(limitedRefresh.status, 429);
    assert.match((await limitedRefresh.json()).message, /refresh attempts/i);

    const login = await post('/login', { body: { email: 'student@satiengg.in', password: 'Valid-test-password-123' } });
    assert.equal(login.status, 401, 'failed refreshes must not exhaust the login/register IP bucket');
  } finally {
    RefreshSession.findOneAndUpdate = originals.sessionFindOneAndUpdate;
    RefreshSession.findOne = originals.sessionFindOne;
    User.findOne = originals.userFindOne;
    await new Promise((resolve) => server.close(resolve));
  }
});
