import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
process.env.NODE_ENV = 'test';

const [{ createApp }, { authMiddleware }, { signAuthToken }, { default: User }, bcrypt] = await Promise.all([
  import('../app.js'),
  import('../middleware/authMiddleware.js'),
  import('../utils/auth.js'),
  import('../models/User.js'),
  import('bcrypt')
]);

const withoutDatabaseCheck = (_req, _res, next) => next();

const request = async (app, path, options = {}) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path,
          method: options.method || 'GET',
          headers: options.headers
        },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
        }
      );
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

test('health reports a database outage without hanging', { concurrency: false }, async () => {
  const response = await request(createApp(), '/api/health');

  assert.equal(response.status, 503);
  assert.equal(response.body.status, 'DEGRADED');
  assert.equal(response.body.database, 'disconnected');
});

test('auth validation rejects empty and malformed login payloads', { concurrency: false }, async () => {
  const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
  const emptyResponse = await request(app, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const malformedResponse = await request(app, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'password123' })
  });

  assert.equal(emptyResponse.status, 400);
  assert.equal(emptyResponse.body.message, 'Missing required fields: email, password');
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedResponse.body.details.email, 'Please provide a valid email');
});

test('student registration stages a pending account and returns a development OTP preview', { concurrency: false }, async () => {
  const { createRegisterStudentHandler } = await import('../controllers/authController.js');

  const payload = { name: 'Test Student', email: 'student@example.edu', enrollmentNumber: 'ENR001', department: 'Engineering', branch: 'CSE', semester: '1', phoneNumber: '1234567890', password: 'A-secure-password-123', confirmPassword: 'A-secure-password-123' };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createRegisterStudentHandler({ deliverCode: async () => ({ previewCode: '123456' }), isDuplicate: async () => false, savePending: async (_filter, update) => ({ _id: 'verification-1', expiresAt: update.$set.expiresAt }), removePending: async () => ({ deletedCount: 0 }), domainPolicy: () => {}, markSent: async () => ({ modifiedCount: 1 }) })({ body: payload }, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.devOtp, '123456');
});

test('login accepts the correct password and rejects an incorrect password', { concurrency: false }, async () => {
  const originalFindOne = User.findOne;
  const user = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Student',
    email: 'student@example.edu',
    enrollmentNumber: 'ENR002',
    password: await bcrypt.hash('A-secure-password-123', 10),
    role: 'student',
    interests: [],
    skills: [],
    contactVisibility: 'connections',
    trustScore: 0,
    isVerifiedStudent: false,
    accountStatus: 'active',
    accountType: 'student',
    emailVerified: true,
    createdAt: new Date()
  };
  User.findOne = async () => user;
  const { createLoginHandler } = await import('../controllers/authController.js');

  try {
    const run = async (password) => {
      const res = { json(body) { this.body = body; } };
      let error;
      await createLoginHandler({ createSession: async (loggedUser) => ({ token: 'short-lived-access', user: { id: loggedUser._id.toString(), email: loggedUser.email } }), findUser: async () => user })({ body: { email: user.email, password }, get: () => '' }, res, (value) => { error = value; });
      return error ? { status: error.status } : { status: 200, body: res.body };
    };
    const valid = await run('A-secure-password-123');
    const invalid = await run('incorrect-password');

    assert.equal(valid.status, 200);
    assert.equal(typeof valid.body.token, 'string');
    assert.equal(invalid.status, 401);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('auth middleware accepts a valid token and rejects invalid or missing tokens', { concurrency: false }, async () => {
  const originalFindById = User.findById;
  const userId = new mongoose.Types.ObjectId().toString();
  User.findById = () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(userId), email: 'student@example.edu', role: 'student', isBlocked: false }) });

  const runMiddleware = (authorization) => new Promise((resolve) => {
    const req = { headers: authorization ? { authorization } : {} };
    authMiddleware(req, {}, (error) => resolve({ error, user: req.user }));
  });

  try {
    const valid = await runMiddleware(`Bearer ${signAuthToken({ userId, email: 'student@example.edu', role: 'student' })}`);
    const invalid = await runMiddleware('Bearer invalid-token');
    const missing = await runMiddleware();

    assert.equal(valid.error, undefined);
    assert.equal(valid.user.userId, userId);
    assert.equal(invalid.error.status, 401);
    assert.equal(missing.error.status, 401);
  } finally {
    User.findById = originalFindById;
  }
});

test('auth middleware blocks suspended accounts and rejects revoked access tokens', { concurrency: false }, async () => {
  const originalFindById = User.findById;
  const userId = new mongoose.Types.ObjectId().toString();
  let state = { _id: new mongoose.Types.ObjectId(userId), email: 'student@example.edu', role: 'student', isBlocked: false, accountStatus: 'suspended', tokenVersion: 0 };
  User.findById = () => ({ select: async () => state });
  const run = async (token) => new Promise((resolve) => authMiddleware({ headers: { authorization: `Bearer ${token}` } }, {}, (error) => resolve(error)));
  try {
    const token = signAuthToken({ userId, tokenVersion: 0 });
    assert.equal((await run(token)).status, 403);
    state = { ...state, accountStatus: 'active', tokenVersion: 1 };
    assert.equal((await run(token)).status, 401);
  } finally { User.findById = originalFindById; }
});

test('auth middleware blocks pending alumni even after email verification', { concurrency: false }, async () => {
  const originalFindById = User.findById;
  const userId = new mongoose.Types.ObjectId().toString();
  User.findById = () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(userId), email: 'alumni@example.com', role: 'alumni', accountType: 'alumni', isBlocked: false, emailVerified: true, verificationStatus: 'pending', accountStatus: 'pending', tokenVersion: 0 }) });
  try {
    const error = await new Promise((resolve) => authMiddleware({ headers: { authorization: `Bearer ${signAuthToken({ userId, tokenVersion: 0 })}` } }, {}, resolve));
    assert.equal(error.status, 403);
  } finally { User.findById = originalFindById; }
});

test('profile update ignores protected role and enrollment fields', { concurrency: false }, async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  let update;
  User.findByIdAndUpdate = async (_id, value) => { update = value; return { _id: 'u', name: 'Safe', role: 'student', email: 'student@example.edu' }; };
  try {
    const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
    const { updateProfile } = await import('../controllers/authController.js');
    const response = await new Promise((resolve) => updateProfile({ user: { userId: 'u' }, body: { name: 'Safe', role: 'super_admin', enrollmentNumber: 'takeover' } }, { json: resolve }, resolve));
    assert.equal(update.role, undefined);
    assert.equal(update.enrollmentNumber, undefined);
    assert.equal(response.data.role, 'student');
  } finally { User.findByIdAndUpdate = originalFindByIdAndUpdate; }
});

test('permission service keeps module permissions separate by role', async () => {
  const { hasPermission } = await import('../utils/permissions.js');
  assert.equal(hasPermission({ role: 'student' }, 'users:manage'), false);
  assert.equal(hasPermission({ role: 'marketplace_moderator' }, 'marketplace:moderate'), true);
  assert.equal(hasPermission({ role: 'college_admin' }, 'users:manage'), true);
  assert.equal(hasPermission({ role: 'admin' }, 'users:block'), true);
  assert.equal(hasPermission({ role: 'admin' }, 'users:manage'), false);
});

test('OTP hashes are bound to email and opaque tokens are not stored directly', async () => {
  const { createOtp, hashOtp, createOpaqueToken, hashToken, secureHashEquals } = await import('../utils/auth.js');
  const otp = createOtp();
  const token = createOpaqueToken();
  assert.match(otp, /^\d{6}$/);
  assert.notEqual(hashOtp('one@example.edu', otp), hashOtp('two@example.edu', otp));
  assert.notEqual(hashToken(token), token);
  assert.equal(secureHashEquals('ab'.repeat(32), 'ab'.repeat(32)), true);
  assert.equal(secureHashEquals('ab'.repeat(32), 'cd'.repeat(32)), false);
});

test('role assignment blocks self escalation and non-super-admin privilege grants', async () => {
  const { validateRoleAssignment } = await import('../controllers/iamAdminController.js');
  assert.equal(validateRoleAssignment({ actorId: 'a', actorRole: 'college_admin', targetId: 'a', targetRole: 'college_admin', nextRole: 'super_admin' }), false);
  assert.equal(validateRoleAssignment({ actorId: 'a', actorRole: 'college_admin', targetId: 'b', targetRole: 'student', nextRole: 'super_admin' }), false);
  assert.equal(validateRoleAssignment({ actorId: 'a', actorRole: 'super_admin', targetId: 'b', targetRole: 'student', nextRole: 'college_admin' }), true);
  assert.equal(validateRoleAssignment({ actorId: 'a', actorRole: 'college_admin', targetId: 'b', targetRole: 'student', nextRole: 'college_admin' }), false);
});

test('student registration domain policy rejects unapproved domains', async () => {
  const { validateCollegeEmail } = await import('../controllers/authController.js');
  assert.throws(() => validateCollegeEmail('student@example.edu', { allowedDomains: [], production: true }), { status: 403 });
  assert.throws(() => validateCollegeEmail('student@example.edu', { allowedDomains: ['college.edu'], production: false }), { status: 400 });
  assert.doesNotThrow(() => validateCollegeEmail('student@college.edu', { allowedDomains: ['college.edu'], production: true }));
});
