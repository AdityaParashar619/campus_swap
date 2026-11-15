import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createServer } from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.JWT_SECRET = 'isolated-login-route-test-secret';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';

const [{ createApp }, { default: User }, { default: RefreshSession }] = await Promise.all([
  import('../app.js'),
  import('../models/User.js'),
  import('../models/RefreshSession.js')
]);

test('actual login route authenticates accounts, sanitizes session failures, and sends exactly one response', { concurrency: false }, async () => {
  const originalFindOne = User.findOne;
  const originalCreate = RefreshSession.create;
  const originalError = console.error;
  const password = 'Route-test-password-123';
  const passwordHash = await bcrypt.hash(password, 8);
  const makeUser = (email, fields = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    name: email === 'admin@satiengg.in' ? 'CampusSwap Admin' : 'Route Test Student',
    email,
    password: passwordHash,
    enrollmentNumber: null,
    role: email === 'admin@satiengg.in' ? 'admin' : 'student',
    accountType: email === 'admin@satiengg.in' ? 'staff' : 'student',
    accountStatus: 'active',
    emailVerified: true,
    tokenVersion: 0,
    createdAt: new Date(),
    ...fields
  });
  const users = new Map([
    ['student@satiengg.in', makeUser('student@satiengg.in')],
    ['admin@satiengg.in', makeUser('admin@satiengg.in')],
    ['unverified@satiengg.in', makeUser('unverified@satiengg.in', { emailVerified: false })],
    ['blocked@satiengg.in', makeUser('blocked@satiengg.in', { isBlocked: true, accountStatus: 'blocked' })],
    ['suspended@satiengg.in', makeUser('suspended@satiengg.in', { accountStatus: 'suspended' })],
    ['storage-failure@satiengg.in', makeUser('storage-failure@satiengg.in')]
  ]);
  const responseCount = new Map();
  const app = createApp({ databaseMiddleware: (_req, _res, next) => next() });
  const server = createServer((req, res) => {
    const caseId = req.headers['x-test-case'];
    res.once('finish', () => responseCount.set(caseId, (responseCount.get(caseId) || 0) + 1));
    app(req, res);
  });
  User.findOne = async ({ email }) => users.get(email) || null;
  RefreshSession.create = async (data) => {
    if (data.user.equals?.(users.get('storage-failure@satiengg.in')._id) || String(data.user) === String(users.get('storage-failure@satiengg.in')._id)) {
      throw new Error('private database failure detail');
    }
    return { _id: new mongoose.Types.ObjectId(), ...data };
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const request = async (caseId, email, suppliedPassword = password) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-case': caseId },
      body: JSON.stringify({ email, password: suppliedPassword })
    });
    const body = await response.json();
    return { response, body };
  };

  const logArgs = [];
  console.error = (...args) => { logArgs.push(args); };
  try {
    const cases = [
      ['student', 'student@satiengg.in', password, 200],
      ['admin', 'admin@satiengg.in', password, 200],
      ['wrong-password', 'student@satiengg.in', 'wrong-password', 401],
      ['unknown-email', 'unknown@satiengg.in', password, 401],
      ['unverified', 'unverified@satiengg.in', password, 401],
      ['blocked', 'blocked@satiengg.in', password, 401],
      ['suspended', 'suspended@satiengg.in', password, 401],
      ['session-failure', 'storage-failure@satiengg.in', password, 500]
    ];

    const results = [];
    for (const [caseId, email, suppliedPassword, expectedStatus] of cases) {
      const { response, body } = await request(caseId, email, suppliedPassword);
      assert.equal(response.status, expectedStatus, `${caseId}: ${JSON.stringify(body)} logs=${JSON.stringify(logArgs)}`);
      assert.equal(body.success, expectedStatus === 200, caseId);
      results.push({ caseId, response, body });
    }

    for (const [caseId] of cases) {
      assert.equal(responseCount.get(caseId), 1, `${caseId} must complete exactly one HTTP response`);
    }

    for (const caseId of ['student', 'admin']) {
      const { response, body } = results.find((result) => result.caseId === caseId);
      const cookie = response.headers.get('set-cookie') || '';
      assert.match(cookie, /refreshToken=/);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Path=\/api\/auth/i);
      assert.equal(body.user.password, undefined);
      assert.equal(typeof body.token, 'string');
    }

    const failure = results.find((result) => result.caseId === 'session-failure');
    assert.equal(failure.body.message, 'Unable to start a session. Please retry.');
    assert.equal(JSON.stringify(failure.body).includes('private database failure detail'), false);
    const requestId = failure.response.headers.get('x-request-id');
    assert.ok(logArgs.some((args) => String(args[0]).includes(requestId) && String(args[0]).includes('Login session creation failed') && args[1]?.type === 'Error'));
    assert.doesNotMatch(JSON.stringify(logArgs), /private database failure detail/);
  } finally {
    console.error = originalError;
    User.findOne = originalFindOne;
    RefreshSession.create = originalCreate;
    await new Promise((resolve) => server.close(resolve));
  }
});
