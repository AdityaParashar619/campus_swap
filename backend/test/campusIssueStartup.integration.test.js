import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { mockIssueCloudinary } from '../test-support/campusIssueCloudinaryMock.js';

const uri = process.env.CAMPUS_ISSUE_STARTUP_TEST_MONGO_URI;

test('cold server startup initializes Campus Issue indexes and accepts repeated uploads', { skip: !uri }, async () => {
  assert.equal(uri, 'mongodb://127.0.0.1:27019/campusswap_issue_init_test');
  Object.assign(process.env, {
    NODE_ENV: 'development', MONGO_URI: uri, JWT_SECRET: 'issue-startup-disposable-signing-key',
    EMAIL_PROVIDER: 'resend', OTP_MOCK_ENABLED: 'true', RESEND_TEST_MODE: 'false',
    CLOUDINARY_CLOUD_NAME: 'issue-startup-mock', CLOUDINARY_API_KEY: 'fixture-key',
    CLOUDINARY_API_SECRET: 'fixture-secret', CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED: 'true'
  });

  // Load the production entry point before connecting, just as the Docker backend does.
  const { httpServer } = await import('../server.js');
  const { connectDB, ensureCampusIssueIndexes } = await import('../config/db.js');
  const { default: CampusIssue } = await import('../models/CampusIssue.js');
  const { default: User } = await import('../models/User.js');
  const { signAuthToken } = await import('../utils/auth.js');
  assert.equal(CampusIssue.db, mongoose.connection);
  assert.equal(mongoose.get('bufferCommands'), false);
  assert.equal(CampusIssue.db.db, undefined);
  assert.throws(() => ensureCampusIssueIndexes(), { status: 503 });
  const cloud = mockIssueCloudinary();
  let user;
  try {
    await new Promise((resolve, reject) => httpServer.listen(0, '127.0.0.1', resolve).once('error', reject));
    const base = `http://127.0.0.1:${httpServer.address().port}`;
    assert.equal((await fetch(base + '/api/campus-issues/mine')).status, 503);
    await connectDB();
    const indexes = await CampusIssue.collection.indexes();
    assert.ok(indexes.some(({ key: index, unique, partialFilterExpression }) =>
      index.createdBy === 1 && index.submissionKey === 1 && unique &&
      partialFilterExpression?.submissionKey?.$type === 'string'));
    assert.ok(indexes.some(({ key: index }) => index.createdBy === 1 && index.createdAt === -1));
    assert.equal(ensureCampusIssueIndexes(), ensureCampusIssueIndexes());
    user = await User.create({
      name: 'Disposable cold-start student', email: `${randomUUID()}@satiengg.in`,
      password: 'unused-fixture-hash', role: 'student', accountType: 'student',
      emailVerified: true, verificationStatus: 'verified', accountStatus: 'active'
    });
    const authorization = `Bearer ${signAuthToken({ userId: user.id, tokenVersion: 0 })}`;
    const call = (path, options = {}) => fetch(base + path, {
      ...options, headers: { authorization, ...options.headers }
    });
    const path = '/api/campus-issues';
    const fixture = { title: 'Cold-start report fixture', description: 'Disposable evidence fixture.', category: 'water' };
    const plain = await call(path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fixture)
    });
    assert.equal(plain.status, 201);
    assert.equal((await call(path + '/mine')).status, 200);
    assert.equal((await call('/api/auth/me')).status, 200);

    const cases = await Promise.all(['webp', 'jpeg', 'png'].map(async (format) => ({
      format, image: await sharp({ create: { width: 12, height: 8, channels: 3, background: '#6495ed' } })
        .toFormat(format).toBuffer()
    })));
    function send(photo, key = randomUUID()) {
      const form = new FormData();
      form.set('issue', JSON.stringify(fixture));
      form.set('submissionKey', key);
      form.set('photos', new Blob([photo.image], { type: `image/${photo.format}` }), `fixture.${photo.format}`);
      return call(path, { method: 'POST', body: form });
    }
    const results = await Promise.all(cases.map((photo) => send(photo)));
    assert.deepEqual(results.map((response) => response.status), [201, 201, 201]);
    const key = randomUUID();
    const retries = await Promise.all([send(cases[0], key), send(cases[0], key)]);
    assert.ok(retries.some((response) => response.status === 201));
    assert.ok(retries.every((response) => [200, 201, 409].includes(response.status)));
    const saved = await Promise.all(retries.filter((response) => response.ok).map((response) => response.json()));
    assert.equal(new Set(saved.map(({ data }) => data.id)).size, 1);
    assert.equal(await CampusIssue.countDocuments({ createdBy: user.id, submissionKey: key }), 1);
    assert.equal(cloud.uploadAttempts, 4);
  } finally {
    cloud.restore();
    try {
      if (httpServer.listening) await new Promise((resolve) => httpServer.close(resolve));
      if (user) {
        await CampusIssue.deleteMany({ createdBy: user.id });
        await User.deleteOne({ _id: user.id });
      }
    } finally {
      await mongoose.disconnect();
    }
  }
});
