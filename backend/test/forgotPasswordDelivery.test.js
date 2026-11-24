import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'forgot-password-delivery-test-secret';
process.env.NODE_ENV = 'test';

const { createForgotPasswordHandler } = await import('../controllers/authController.js');
const { default: User } = await import('../models/User.js');

const invoke = (handler, req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; resolve({ res: this }); }
  };
  handler(req, res, (error) => resolve({ res, error }));
});

test('forgot password sends the six-digit OTP to the normalized registered SATI address without exposing it', async () => {
  let lookupEmail;
  let pendingWrite;
  let sent;
  const handler = createForgotPasswordHandler({
    findAccount: async (email) => {
      lookupEmail = email;
      return { _id: 'student-test-id', email: 'EXAMPLE27CS987@SATIENGG.IN' };
    },
    findPending: async () => null,
    savePending: async (_email, update) => {
      pendingWrite = update.$set;
      return { _id: 'pending-reset-test' };
    },
    deliverCode: async (message) => { sent = message; return {}; }
  });

  const { res } = await invoke(handler, { body: { email: '  EXAMPLE27CS987@SATIENGG.IN ' }, requestId: 'forgot-delivery-test' });
  assert.equal(res.statusCode, 200);
  assert.equal(lookupEmail, 'example27cs987@satiengg.in');
  assert.equal(sent.to, 'example27cs987@satiengg.in');
  assert.match(sent.code, /^\d{6}$/);
  assert.equal(sent.requestId, 'forgot-delivery-test');
  assert.equal(pendingWrite.payload.userId, 'student-test-id');
  assert.notEqual(pendingWrite.otpHash, sent.code);
  assert.equal(res.body.resetAuthorization, undefined);
  assert.equal(res.body.otp, undefined);
});

test('unknown and eligible accounts receive the same enumeration-safe response', async () => {
  const responseFor = async (findAccount) => {
    let sends = 0;
    const handler = createForgotPasswordHandler({
      findAccount,
      findPending: async () => null,
      savePending: async () => ({ _id: 'pending-reset-test' }),
      deliverCode: async () => { sends += 1; return {}; }
    });
    const result = await invoke(handler, { body: { email: 'student27cs011@satiengg.in' } });
    return { statusCode: result.res.statusCode, body: result.res.body, sends };
  };

  const eligible = await responseFor(async () => ({ _id: 'student-test-id', email: 'student27cs011@satiengg.in' }));
  const unknown = await responseFor(async () => null);
  assert.equal(eligible.statusCode, unknown.statusCode);
  assert.deepEqual(eligible.body, unknown.body);
  assert.equal(eligible.sends, 1);
  assert.equal(unknown.sends, 0);
});

test('delivery failure clears the pending code but retains the generic HTTP 200 response', async () => {
  let removed;
  const handler = createForgotPasswordHandler({
    findAccount: async () => ({ _id: 'student-test-id', email: 'student27cs011@satiengg.in' }),
    findPending: async () => null,
    savePending: async () => ({ _id: 'pending-reset-test' }),
    removePending: async (...args) => { removed = args; },
    deliverCode: async () => { throw new Error('private SMTP failure detail'); }
  });
  const { res } = await invoke(handler, { body: { email: 'student27cs011@satiengg.in' } });
  assert.equal(res.statusCode, 200);
  assert.equal(removed[0], 'pending-reset-test');
  assert.match(res.body.message, /if this address is eligible/i);
  assert.equal(JSON.stringify(res.body).includes('private SMTP failure detail'), false);
  assert.equal(res.body.otp, undefined);
});

test('forgot-password account lookup includes active verified staff administrators', async () => {
  const originalFindOne = User.findOne;
  let query;
  let deliveredTo;
  User.findOne = async (criteria) => {
    query = criteria;
    return { _id: 'admin-test-id', email: 'admin27cs011@satiengg.in', accountType: 'staff', role: 'admin' };
  };
  try {
    const handler = createForgotPasswordHandler({
      findPending: async () => null,
      savePending: async () => ({ _id: 'pending-reset-test' }),
      deliverCode: async ({ to }) => { deliveredTo = to; return {}; }
    });
    const { res } = await invoke(handler, { body: { email: 'ADMIN27CS011@SATIENGG.IN' } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(query, {
      email: 'admin27cs011@satiengg.in',
      emailVerified: { $ne: false },
      accountStatus: { $in: ['active', null] }
    });
    assert.equal(deliveredTo, 'admin27cs011@satiengg.in');
  } finally {
    User.findOne = originalFindOne;
  }
});

test('a later eligible OTP request replaces the earlier reset OTP', async () => {
  const { hashOtp } = await import('../utils/auth.js');
  const generated = ['111111', '222222'];
  const sent = [];
  let persisted;
  const handler = createForgotPasswordHandler({
    generateCode: () => generated.shift(),
    findAccount: async () => ({ _id: 'student-test-id', email: 'student27cs011@satiengg.in' }),
    findPending: async () => ({ lastSentAt: new Date(Date.now() - 61_000) }),
    savePending: async (_email, update) => {
      persisted = update.$set;
      return { _id: 'pending-reset-test' };
    },
    deliverCode: async ({ code }) => { sent.push(code); return {}; }
  });

  await invoke(handler, { body: { email: 'student27cs011@satiengg.in' } });
  await invoke(handler, { body: { email: 'student27cs011@satiengg.in' } });
  assert.deepEqual(sent, ['111111', '222222']);
  assert.equal(persisted.otpHash, hashOtp('student27cs011@satiengg.in', '222222', 'password-reset'));
  assert.notEqual(persisted.otpHash, hashOtp('student27cs011@satiengg.in', '111111', 'password-reset'));
});
