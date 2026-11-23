import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';

const uri = process.env.OTP_INDEX_REHEARSAL_URI;

test('concurrent password-reset issuance keeps one OTP per normalized email and kind', { skip: !uri, timeout: 15_000 }, async (t) => {
  assert.equal(uri, 'mongodb://127.0.0.1:27019/campusswap_otp_index_rehearsal_test');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'disposable-otp-index-rehearsal-secret';
  const { createForgotPasswordHandler } = await import('../controllers/authController.js');
  const { default: EmailVerification } = await import('../models/EmailVerification.js');

  await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5_000 });
  try {
    const indexes = await EmailVerification.collection.indexes();
    assert.ok(indexes.some(({ name, key, unique }) =>
      name === 'email_1_kind_1' && key.email === 1 && key.kind === 1 && unique));

    const email = `reset-${randomUUID()}@fixture.invalid`;
    const user = { _id: new mongoose.Types.ObjectId(), email };
    const otherKind = { email, kind: 'student', payload: { synthetic: true }, expiresAt: new Date(Date.now() + 86_400_000) };
    await EmailVerification.create(otherKind);
    await assert.rejects(EmailVerification.create(otherKind), { code: 11000 });

    // Hold both requests after they have checked for existing reset OTPs.
    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    let reads = 0;
    let deliveries = 0;
    const handler = createForgotPasswordHandler({
      findAccount: async (address) => {
        assert.equal(address, email);
        return user;
      },
      findPending: async (address) => {
        const pending = await EmailVerification.findOne({ email: address, kind: 'password_reset' });
        assert.equal(pending, null);
        if (++reads === 2) release();
        await barrier;
        return pending;
      },
      deliverCode: async () => { deliveries++; return {}; }
    });
    const issue = (address) => new Promise((resolve, reject) => {
      handler({ body: { email: address } }, { json: resolve }, reject);
    });

    const results = await Promise.all([issue(email), issue(` ${email.toUpperCase()} `)]);
    assert.ok(results.every(({ success }) => success));
    assert.equal(await EmailVerification.countDocuments({ email, kind: 'password_reset' }), 1);
    assert.equal(await EmailVerification.countDocuments({ email, kind: 'student' }), 1);
    assert.equal(deliveries, 2);
    t.diagnostic('Two overlapping requests reached mock delivery and left one reset OTP record.');
  } finally {
    await mongoose.disconnect();
  }
});
