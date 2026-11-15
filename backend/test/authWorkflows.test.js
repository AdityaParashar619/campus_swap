import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

process.env.JWT_SECRET = 'isolated-auth-workflow-test-secret';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';

const [{ env }, { createForgotPasswordHandler, forgotPassword, resetPassword, verifyPasswordResetOtp, registerAlumni, verifyAlumniEmail, verifyStudentEmail, resendStudentOtp }, { consumeDevelopmentMail }, { hashOtp }, { default: User }, { default: RefreshSession }, { default: AlumniVerification }, { default: EmailVerification }, { default: EnrollmentReservation }] = await Promise.all([
  import('../config/env.js'),
  import('../controllers/authController.js'),
  import('../utils/devMailCapture.js'),
  import('../utils/auth.js'),
  import('../models/User.js'),
  import('../models/RefreshSession.js'),
  import('../models/AlumniVerification.js'),
  import('../models/EmailVerification.js'),
  import('../models/EnrollmentReservation.js')
]);

const invoke = (handler, req) => new Promise((resolve) => {
  const res = { status(code) { this.statusCode = code; return this; }, set() { return this; }, json(body) { this.body = body; resolve({ res: this }); } };
  handler(req, res, (error) => resolve({ res, error }));
});

test('expired and incorrect OTPs fail without activating an account and incorrect attempts are counted', { concurrency: false }, async () => {
  const originals = {
    findOne: EmailVerification.findOne,
    findOneAndUpdate: EmailVerification.findOneAndUpdate,
    updateOne: EmailVerification.updateOne,
    reservationFindOne: EnrollmentReservation.findOne,
    userCreate: User.create
  };
  const email = 'otpflow24cs012@satiengg.in';
  const entry = { _id: 'pending-verification', otpHash: hashOtp(email, '123456', 'password-reset'), expiresAt: new Date(Date.now() + 60_000), attempts: 0, payload: { enrollmentNumber: '0108cs241010' } };
  let currentEntry = entry;
  let attemptsUpdated = 0;
  let accountCreated = false;
  EmailVerification.findOne = async () => currentEntry;
  EmailVerification.findOneAndUpdate = async (query) => query.otpHash === entry.otpHash ? entry : null;
  EmailVerification.updateOne = async () => { attemptsUpdated += 1; return { modifiedCount: 1 }; };
  EnrollmentReservation.findOne = async () => ({ email, enrollmentNumber: entry.payload.enrollmentNumber, expiresAt: entry.expiresAt });
  User.create = async () => { accountCreated = true; throw new Error('Unexpected account creation'); };
  try {
    const incorrect = await new Promise((resolve) => verifyStudentEmail({ body: { email, otp: '000000' } }, {}, resolve));
    assert.equal(incorrect.status, 400);
    assert.equal(attemptsUpdated, 1);
    assert.equal(accountCreated, false);

    currentEntry = null;
    const expired = await new Promise((resolve) => verifyStudentEmail({ body: { email, otp: '123456' } }, {}, resolve));
    assert.equal(expired.status, 400);
    assert.equal(accountCreated, false);
  } finally {
    EmailVerification.findOne = originals.findOne;
    EmailVerification.findOneAndUpdate = originals.findOneAndUpdate;
    EmailVerification.updateOne = originals.updateOne;
    EnrollmentReservation.findOne = originals.reservationFindOne;
    User.create = originals.userCreate;
  }
});

test('registration OTP is rejected by the password-reset OTP verifier', { concurrency: false }, async () => {
  const originalFindOne = EmailVerification.findOne;
  const originalUpdateOne = EmailVerification.updateOne;
  const email = 'crosspurpose24cs012@satiengg.in';
  let attempts = 0;
  EmailVerification.findOne = async () => ({
    _id: 'reset-entry', email, kind: 'password_reset',
    otpHash: hashOtp(email, '123456', 'student-verification'),
    expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    payload: { userId: 'student-id' }
  });
  EmailVerification.updateOne = async () => { attempts += 1; return { modifiedCount: 1 }; };
  try {
    const result = await invoke(verifyPasswordResetOtp, { body: { email, otp: '123456' } });
    assert.equal(result.error.status, 400);
    assert.equal(attempts, 1);
  } finally {
    EmailVerification.findOne = originalFindOne;
    EmailVerification.updateOne = originalUpdateOne;
  }
});

test('password-reset OTP expiry and attempt limits prevent authorization issuance', { concurrency: false }, async () => {
  const originalFindOne = EmailVerification.findOne;
  const originalUpdateOne = EmailVerification.updateOne;
  const email = 'resetlimit24cs012@satiengg.in';
  const entry = {
    _id: 'reset-entry', email, kind: 'password_reset',
    otpHash: hashOtp(email, '123456', 'password-reset'),
    expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    payload: { userId: 'student-id' }
  };
  let current = entry;
  EmailVerification.findOne = async (_query) => current && current.expiresAt > new Date() && current.attempts < env.otpMaxAttempts ? current : null;
  EmailVerification.updateOne = async (query, update) => {
    if (current && current.expiresAt > new Date() && current.attempts < query.attempts.$lt) current.attempts += update.$inc.attempts;
    return { modifiedCount: 1 };
  };
  try {
    for (let attempt = 0; attempt < env.otpMaxAttempts; attempt += 1) {
      const invalid = await invoke(verifyPasswordResetOtp, { body: { email, otp: '000000' } });
      assert.equal(invalid.error.status, 400);
    }
    assert.equal(entry.attempts, env.otpMaxAttempts);
    const exhausted = await invoke(verifyPasswordResetOtp, { body: { email, otp: '123456' } });
    assert.equal(exhausted.error.status, 400);
    assert.equal(entry.attempts, env.otpMaxAttempts);
    current = { ...entry, attempts: 0, expiresAt: new Date(Date.now() - 1) };
    const expired = await invoke(verifyPasswordResetOtp, { body: { email, otp: '123456' } });
    assert.equal(expired.error.status, 400);
    assert.equal(current.attempts, 0);
  } finally {
    EmailVerification.findOne = originalFindOne;
    EmailVerification.updateOne = originalUpdateOne;
  }
});

test('OTP resend cooldown rejects immediate reissue without sending a new code', { concurrency: false }, async () => {
  const originalFindOne = EmailVerification.findOne;
  const entry = { lastSentAt: new Date(), save: async () => { throw new Error('Must not save during cooldown.'); } };
  EmailVerification.findOne = async () => entry;
  try {
    const error = await new Promise((resolve) => resendStudentOtp({ body: { email: 'student@satiengg.in' } }, {}, resolve));
    assert.equal(error.status, 400);
  } finally {
    EmailVerification.findOne = originalFindOne;
  }
});

test('password recovery verifies a leading-zero OTP for an active staff account and issues a one-use authorization', { concurrency: false }, async () => {
  const originals = {
    env: { nodeEnv: env.nodeEnv, emailProvider: env.emailProvider, otpMockEnabled: env.otpMockEnabled, resendApiKey: env.resendApiKey, resendTestMode: env.resendTestMode, resendTestRecipient: env.resendTestRecipient, resendDomainVerified: env.resendDomainVerified, emailFrom: env.emailFrom },
    userFindOne: User.findOne, userFindOneAndUpdate: User.findOneAndUpdate,
    verificationFindOne: EmailVerification.findOne, verificationFindOneAndUpdate: EmailVerification.findOneAndUpdate,
    verificationDelete: EmailVerification.deleteOne, verificationUpdate: EmailVerification.updateOne,
    revoke: RefreshSession.updateMany
  };
  const email = 'student@satiengg.in';
  const user = { _id: 'staff-id', email, accountType: 'staff', role: 'admin', emailVerified: true, accountStatus: 'active' };
  let entry;
  let resetQuery;
  let resetUpdate;
  let authorizationQuery;
  let revoked;
  env.nodeEnv = 'development'; env.emailProvider = 'resend'; env.otpMockEnabled = true; env.resendApiKey = ''; env.resendTestMode = false; env.emailFrom = '';
  User.findOne = async () => user;
  User.findOneAndUpdate = async (query, update) => {
    if (update.$set?.resetPasswordToken && !update.$set?.password) { authorizationQuery = query; user.resetPasswordToken = update.$set.resetPasswordToken; user.resetPasswordExpiresAt = update.$set.resetPasswordExpiresAt; return user; }
    if (query.resetPasswordToken !== user.resetPasswordToken || !user.resetPasswordToken) return null;
    resetQuery = query; resetUpdate = update;
    user.resetPasswordToken = null;
    return user;
  };
  EmailVerification.findOne = async () => entry;
  EmailVerification.findOneAndUpdate = async (query, update) => {
    if (query.email && update.$set?.kind === undefined) {
      entry = { _id: 'reset-otp-id', email, kind: 'password_reset', ...update.$set };
      return entry;
    }
    if (entry?._id === query._id && entry.otpHash === query.otpHash && entry.expiresAt > new Date() && entry.attempts < env.otpMaxAttempts) {
      const old = { ...entry };
      Object.assign(entry, update.$set);
      return old;
    }
    return null;
  };
  EmailVerification.updateOne = async (_query, update) => { if (entry) entry.attempts += update.$inc.attempts; return { modifiedCount: entry ? 1 : 0 }; };
  EmailVerification.deleteOne = async () => { entry = null; return { deletedCount: 1 }; };
  RefreshSession.updateMany = async (filter) => { revoked = filter; return { modifiedCount: 1 }; };
  try {
    const forgotPasswordWithFixedTestCode = createForgotPasswordHandler({ generateCode: () => '004219' });
    const requested = await invoke(forgotPasswordWithFixedTestCode, { body: { email: email.toUpperCase() }, requestId: 'workflow-test' });
    assert.equal(requested.res.body.success, true);
    assert.equal(requested.res.body.resetAuthorization, undefined);
    const captured = consumeDevelopmentMail(requested.res.body.devMailPreviewToken);
    assert.equal(captured.purpose, 'password-reset');
    assert.equal(captured.code, '004219');
    assert.notEqual(hashOtp(email, captured.code, 'password-reset'), hashOtp(email, captured.code, 'student-verification'));

    const authorized = await invoke(verifyPasswordResetOtp, { body: { email: email.toUpperCase(), otp: captured.code }, requestId: 'workflow-test' });
    assert.equal(authorized.res.body.success, true);
    assert.ok(authorized.res.body.resetAuthorization);
    assert.equal(authorizationQuery.accountType, undefined);
    assert.deepEqual(authorizationQuery.accountStatus, { $in: ['active', null] });
    const repeatedVerification = await invoke(verifyPasswordResetOtp, { body: { email, otp: captured.code }, requestId: 'workflow-test' });
    assert.equal(repeatedVerification.error.status, 400);
    const authToken = authorized.res.body.resetAuthorization;
    const reset = await invoke(resetPassword, { body: { token: authToken, password: 'New-secure-password-456' }, requestId: 'workflow-test' });
    assert.equal(reset.res.body.message, 'Password reset successful');
    assert.equal(resetQuery.resetPasswordToken, crypto.createHash('sha256').update(authToken).digest('hex'));
    assert.ok(await bcrypt.compare('New-secure-password-456', resetUpdate.$set.password));
    assert.equal(resetUpdate.$set.resetPasswordToken, null);
    assert.equal(resetUpdate.$inc.tokenVersion, 1);
    assert.deepEqual(revoked, { user: user._id, revokedAt: null });

    const reused = await invoke(resetPassword, { body: { token: authToken, password: 'New-secure-password-456' } });
    assert.equal(reused.error.status, 400);
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.userFindOne; User.findOneAndUpdate = originals.userFindOneAndUpdate;
    EmailVerification.findOne = originals.verificationFindOne; EmailVerification.findOneAndUpdate = originals.verificationFindOneAndUpdate;
    EmailVerification.deleteOne = originals.verificationDelete; EmailVerification.updateOne = originals.verificationUpdate;
    RefreshSession.updateMany = originals.revoke;
  }
});

test('password-reset email provider failure keeps an enumeration-safe response and clears its pending OTP', { concurrency: false }, async () => {
  const originals = {
    env: { nodeEnv: env.nodeEnv, emailProvider: env.emailProvider, otpMockEnabled: env.otpMockEnabled, resendApiKey: env.resendApiKey, resendTestMode: env.resendTestMode, resendTestRecipient: env.resendTestRecipient, resendDomainVerified: env.resendDomainVerified, emailFrom: env.emailFrom },
    findOne: User.findOne,
    verificationFindOne: EmailVerification.findOne,
    verificationFindOneAndUpdate: EmailVerification.findOneAndUpdate,
    verificationDelete: EmailVerification.deleteOne,
    error: console.error
  };
  let removed;
  const user = { _id: 'student-id', email: 'student@satiengg.in', accountType: 'student', emailVerified: true, accountStatus: 'active' };
  env.emailProvider = 'resend';
  env.nodeEnv = 'development'; env.otpMockEnabled = false; env.resendApiKey = ''; env.resendTestMode = false; env.emailFrom = '';
  User.findOne = async () => user;
  EmailVerification.findOne = async () => null;
  EmailVerification.findOneAndUpdate = async (_filter, update) => ({ _id: 'pending-reset', otpHash: update.$set.otpHash });
  EmailVerification.deleteOne = async (filter) => { removed = filter; return { deletedCount: 1 }; };
  console.error = () => {};
  try {
    const { res } = await invoke(forgotPassword, { body: { email: user.email }, requestId: 'provider-failure-test' });
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /if this address is eligible/i);
    assert.doesNotMatch(res.body.message, /have been sent/i);
    assert.equal(res.body.devMailPreviewToken, undefined);
    assert.equal(removed._id, 'pending-reset');
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.findOne; EmailVerification.findOne = originals.verificationFindOne;
    EmailVerification.findOneAndUpdate = originals.verificationFindOneAndUpdate; EmailVerification.deleteOne = originals.verificationDelete;
    console.error = originals.error;
  }
});

test('mock alumni verification returns a local link and verifies it once into pending review', { concurrency: false }, async () => {
  const originals = {
    env: { nodeEnv: env.nodeEnv, emailProvider: env.emailProvider, otpMockEnabled: env.otpMockEnabled, resendApiKey: env.resendApiKey, resendTestMode: env.resendTestMode, resendTestRecipient: env.resendTestRecipient, resendDomainVerified: env.resendDomainVerified, emailFrom: env.emailFrom },
    userExists: User.exists,
    userCreate: User.create,
    verificationFindOne: AlumniVerification.findOne,
    verificationFindOneAndUpdate: AlumniVerification.findOneAndUpdate,
    verificationDelete: AlumniVerification.deleteOne
  };
  env.nodeEnv = 'development'; env.emailProvider = 'resend'; env.otpMockEnabled = true; env.resendApiKey = ''; env.resendTestMode = false; env.emailFrom = '';
  User.exists = async () => false;
  AlumniVerification.findOne = async () => null;
  let verification;
  AlumniVerification.findOneAndUpdate = async (filter, update) => {
    if (filter.status === 'email_pending') {
      return verification?.status === 'email_pending' && verification.emailTokenHash === filter.emailTokenHash ? verification : null;
    }
    verification = { _id: 'alumni-verification-id', ...update.$set, save: async () => {} };
    return verification;
  };
  AlumniVerification.deleteOne = async () => ({ deletedCount: 1 });
  let created;
  User.create = async (data) => { created = { _id: 'alumni-user-id', ...data }; return created; };
  try {
    const signup = await invoke(registerAlumni, { body: { name: 'Alumni', email: 'alumni@example.com', graduationYear: '2020', department: 'CSE', branch: 'cs', password: 'Alumni-secure-password-456', confirmPassword: 'Alumni-secure-password-456' } });
    assert.equal(signup.res.statusCode, 202);
    assert.equal(signup.res.body.previewUrl, undefined);
    const link = new URL(consumeDevelopmentMail(signup.res.body.devMailPreviewToken).url);
    const rawToken = new URLSearchParams(link.hash.slice(1)).get('token');
    assert.equal(link.searchParams.get('email'), 'alumni@example.com');
    assert.ok(rawToken);

    const verificationResult = await invoke(verifyAlumniEmail, { body: { email: 'alumni@example.com', token: rawToken } });
    assert.equal(verificationResult.res.body.success, true);
    assert.equal(created.accountStatus, 'pending');
    assert.equal(created.verificationStatus, 'pending');
    assert.equal(verification.status, 'pending');
    assert.equal(verification.emailTokenHash, null);
    const reused = await invoke(verifyAlumniEmail, { body: { email: 'alumni@example.com', token: rawToken } });
    assert.equal(reused.error.status, 400);
  } finally {
    Object.assign(env, originals.env);
    User.exists = originals.userExists; User.create = originals.userCreate;
    AlumniVerification.findOne = originals.verificationFindOne;
    AlumniVerification.findOneAndUpdate = originals.verificationFindOneAndUpdate;
    AlumniVerification.deleteOne = originals.verificationDelete;
  }
});
