import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET ||= 'isolated-product-image-route-secret';
process.env.NODE_ENV = 'test';

const [{ createApp }, { default: User }, { signAuthToken }] = await Promise.all([
  import('../app.js'), import('../models/User.js'), import('../utils/auth.js')
]);

const withoutDatabaseCheck = (_req, _res, next) => next();

test('image upload route requires authentication and enforces its upload rate limit', { concurrency: false }, async () => {
  const originalFind = User.findById;
  const userId = '507f1f77bcf86cd799439011';
  User.findById = () => ({ select: async () => ({ _id: userId, email: 'student@satiengg.in', role: 'student', accountType: 'student', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active', tokenVersion: 0, permissions: [] }) });
  const server = createServer(createApp({ databaseMiddleware: withoutDatabaseCheck }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const unauthorized = await fetch(`${baseUrl}/api/listings/images`, { method: 'POST' });
    assert.equal(unauthorized.status, 401);
    const token = signAuthToken({ userId, tokenVersion: 0 });
    let finalResponse;
    for (let index = 0; index < 21; index += 1) {
      finalResponse = await fetch(`${baseUrl}/api/listings/images`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    }
    assert.equal(finalResponse.status, 429);
  } finally {
    User.findById = originalFind;
    await new Promise((resolve) => server.close(resolve));
  }
});
