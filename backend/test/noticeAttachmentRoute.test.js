import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET ||= 'isolated-notice-attachment-route-secret';
process.env.NODE_ENV = 'test';

const [{ createApp }, { default: User }, { signAuthToken }] = await Promise.all([
  import('../app.js'), import('../models/User.js'), import('../utils/auth.js')
]);
const withoutDatabaseCheck = (_req, _res, next) => next();

test('notice attachment upload and removal routes reject unauthenticated and student callers', { concurrency: false }, async () => {
  const originalFind = User.findById;
  const userId = '507f1f77bcf86cd799439011';
  User.findById = () => ({ select: async () => ({ _id: userId, email: 'student@satiengg.in', role: 'student', accountType: 'student', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active', tokenVersion: 0, permissions: [] }) });
  const server = createServer(createApp({ databaseMiddleware: withoutDatabaseCheck }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/notices/507f1f77bcf86cd799439012/attachments`;
  try {
    assert.equal((await fetch(base, { method: 'POST' })).status, 401);
    const headers = { authorization: `Bearer ${signAuthToken({ userId, tokenVersion: 0 })}` };
    assert.equal((await fetch(base, { method: 'POST', headers })).status, 403);
    assert.equal((await fetch(`${base}/507f1f77bcf86cd799439013`, { method: 'DELETE', headers })).status, 403);
  } finally { User.findById = originalFind; await new Promise((resolve) => server.close(resolve)); }
});
