import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-socket-auth-test-secret';
process.env.NODE_ENV = 'test';

const [{ socketAuthMiddleware }, { signAuthToken }, { default: User }] = await Promise.all([
  import('../middleware/socketAuthMiddleware.js'),
  import('../utils/auth.js'),
  import('../models/User.js')
]);

test('socket middleware authenticates the token subject and ignores client-supplied identity', { concurrency: false }, async () => {
  const original = User.findById;
  const state = { _id: { toString: () => 'server-user-id' }, isBlocked: false, accountStatus: 'active', tokenVersion: 3 };
  let lookedUp;
  User.findById = (id) => { lookedUp = id; return { select: async () => state }; };
  const socket = { handshake: { auth: { token: signAuthToken({ userId: 'server-user-id', tokenVersion: 3, userIdFromClient: 'attacker-id' }) } }, data: {} };
  try {
    const error = await new Promise((resolve) => socketAuthMiddleware(socket, resolve));
    assert.equal(error, undefined);
    assert.equal(lookedUp, 'server-user-id');
    assert.equal(socket.data.userId, 'server-user-id');
  } finally { User.findById = original; }
});

test('socket middleware rejects missing, invalid, blocked and revoked accounts', { concurrency: false }, async () => {
  const original = User.findById;
  const makeSocket = (token) => ({ handshake: { auth: { token } }, data: {} });
  try {
    const missing = await new Promise((resolve) => socketAuthMiddleware(makeSocket(''), resolve));
    const invalid = await new Promise((resolve) => socketAuthMiddleware(makeSocket('invalid'), resolve));
    assert.equal(missing.message, 'Unauthorized');
    assert.equal(invalid.message, 'Unauthorized');

    User.findById = () => ({ select: async () => ({ _id: { toString: () => 'u' }, isBlocked: true, accountStatus: 'active', tokenVersion: 0 }) });
    const blocked = await new Promise((resolve) => socketAuthMiddleware(makeSocket(signAuthToken({ userId: 'u', tokenVersion: 0 })), resolve));
    assert.equal(blocked.message, 'Unauthorized');

    User.findById = () => ({ select: async () => ({ _id: { toString: () => 'u' }, isBlocked: false, accountStatus: 'active', tokenVersion: 2 }) });
    const revoked = await new Promise((resolve) => socketAuthMiddleware(makeSocket(signAuthToken({ userId: 'u', tokenVersion: 1 })), resolve));
    assert.equal(revoked.message, 'Unauthorized');
  } finally { User.findById = original; }
});
