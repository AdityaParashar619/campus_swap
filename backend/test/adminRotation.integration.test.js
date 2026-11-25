import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const uri = process.env.ADMIN_ROTATION_TEST_MONGO_URI;

test('offline administrator rotation preserves identity, revokes old sessions and leaves student access intact', { skip: !uri }, async () => {
  assert.equal(uri, 'mongodb://127.0.0.1:27019/campusswap_admin_rotation_test');
  Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: 'isolated-admin-rotation-test-signing-key',
    EMAIL_PROVIDER: 'resend', OTP_MOCK_ENABLED: 'true', RESEND_TEST_MODE: 'false',
    FRONTEND_URL: 'http://127.0.0.1:8094', ADMIN_BOOTSTRAP_ENABLED: 'false', SERVE_FRONTEND: 'false'
  });
  const { createApp } = await import('../app.js');
  const { default: User } = await import('../models/User.js');
  const { default: RefreshSession } = await import('../models/RefreshSession.js');
  const { default: EmailVerification } = await import('../models/EmailVerification.js');
  const secret = () => 'Aa1!' + randomBytes(24).toString('base64url');
  const oldPassword = secret(), newPassword = secret(), studentPassword = secret();
  const adminEmail = 'rotation-admin@example.invalid', studentEmail = 'rotation-student@example.invalid';
  let server;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    dbName: 'campusswap_admin_rotation_' + randomBytes(6).toString('hex') + '_test'
  });
  try {
    assert.equal(await User.estimatedDocumentCount(), 0, 'Use a fresh disposable database');
    const common = { emailVerified: true, verificationStatus: 'verified', accountStatus: 'active' };
    const admin = await User.create({ ...common, name: 'Rotation Admin', email: adminEmail, role: 'admin',
      accountType: 'staff', tokenVersion: 0, password: await bcrypt.hash(oldPassword, 12) });
    const student = await User.create({ ...common, name: 'Rotation Student', email: studentEmail, role: 'student',
      accountType: 'student', tokenVersion: 0, password: await bcrypt.hash(studentPassword, 12) });
    let base;
    const start = async () => {
      server = createApp().listen(0, '127.0.0.1');
      await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
      base = 'http://127.0.0.1:' + server.address().port;
    };
    const stop = async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const call = (path, { body, cookie, token, method = body ? 'POST' : 'GET' } = {}) => fetch(base + '/api' + path, {
      method, headers: {
        origin: process.env.FRONTEND_URL,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const login = async (email, password) => {
      const response = await call('/auth/login', { body: { email, password } });
      assert.equal(response.status, 200);
      return { token: (await response.json()).token, cookie: response.headers.get('set-cookie').split(';')[0] };
    };
    await start();
    const adminSession = await login(adminEmail, oldPassword);
    const secondAdminSession = await login(adminEmail, oldPassword);
    const studentSession = await login(studentEmail, studentPassword);
    const legacyToken = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
    assert.equal((await call('/auth/me', { token: legacyToken })).status, 200);
    await stop(); // No application writers or existing sockets during the offline procedure.

    const target = { _id: admin._id, email: adminEmail, role: 'admin' };
    const expiresAt = new Date(Date.now() + 60_000);
    await EmailVerification.create([
      { email: adminEmail, kind: 'password_reset', otpHash: secret(), payload: { userId: admin.id }, expiresAt },
      { email: studentEmail, kind: 'password_reset', otpHash: secret(), payload: { userId: student.id }, expiresAt }
    ]);
    const previous = await User.findOne(target);
    const rotated = await User.updateOne({ ...target, tokenVersion: previous.tokenVersion, password: previous.password }, {
      $set: { password: await bcrypt.hash(newPassword, 12), resetPasswordToken: null,
        resetPasswordExpiresAt: null, resetPasswordOtpVerifiedAt: null },
      $inc: { tokenVersion: 1 }
    }, { runValidators: true });
    assert.equal(rotated.modifiedCount, 1);
    const affected = await RefreshSession.updateMany({ user: admin._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    assert.equal(affected.modifiedCount, 2);
    assert.equal(await RefreshSession.countDocuments({ user: admin._id, revokedAt: null }), 0);
    const pendingReset = { email: adminEmail, kind: 'password_reset', 'payload.userId': admin.id };
    const invalidated = await EmailVerification.updateOne(pendingReset, {
      $set: { otpHash: null, authorizationHash: null, expiresAt: new Date() }
    });
    assert.equal(invalidated.modifiedCount, 1);
    assert.equal(await EmailVerification.countDocuments({ ...pendingReset, otpHash: { $ne: null } }), 0);
    assert.equal(await EmailVerification.countDocuments({ email: studentEmail, otpHash: { $ne: null } }), 1);

    await start();
    assert.equal((await call('/auth/me', { token: adminSession.token })).status, 401);
    assert.equal((await call('/auth/me', { token: legacyToken })).status, 401);
    for (const { cookie } of [adminSession, secondAdminSession]) {
      assert.equal((await call('/auth/refresh', { cookie, method: 'POST' })).status, 401);
    }
    assert.equal((await call('/auth/login', { body: { email: adminEmail, password: oldPassword } })).status, 401);
    const newSession = await login(adminEmail, newPassword);
    assert.equal((await call('/admin/campus-locations', { token: newSession.token })).status, 200);
    assert.equal((await call('/auth/me', { token: studentSession.token })).status, 200);
    assert.equal((await call('/admin/campus-locations', { token: studentSession.token })).status, 403);
    assert.equal((await call('/auth/refresh', { cookie: studentSession.cookie, method: 'POST' })).status, 200);
    assert.equal(await User.countDocuments(target), 1);
    assert.equal((await User.findById(student._id)).tokenVersion, 0);
  } finally {
    try {
      if (server?.listening) await new Promise((resolve) => server.close(resolve));
    } finally {
      await mongoose.disconnect();
    }
  }
});
