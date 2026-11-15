import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';
import mongoose from 'mongoose';

process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ALLOWED_COLLEGE_DOMAINS = 'satiengg.in';
process.env.INSTITUTION_EMAIL_PATTERN = '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$';
process.env.ENROLLMENT_PATTERN = '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$';
process.env.INSTITUTION_BRANCHES = 'cs,bc,ai,ds,it,iot,ec,ce,me,ee';

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

test('student registration is public and does not require a refresh session', { concurrency: false }, async () => {
  const response = await request(createApp({ databaseMiddleware: withoutDatabaseCheck }), '/api/auth/register/student', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Missing required fields: email');
});

test('missing and expired refresh cookies return 401 without refresh recursion', { concurrency: false }, async () => {
  const { default: RefreshSession } = await import('../models/RefreshSession.js');
  const originalFindOneAndUpdate = RefreshSession.findOneAndUpdate;
  const originalFindOne = RefreshSession.findOne;
  RefreshSession.findOneAndUpdate = async () => null;
  RefreshSession.findOne = async () => null;
  try {
    const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
    const options = { method: 'POST', headers: { origin: 'http://localhost:5173' } };
    const missing = await request(app, '/api/auth/refresh', options);
    const expired = await request(app, '/api/auth/refresh', { ...options, headers: { ...options.headers, cookie: 'refreshToken=expired-token' } });
    assert.equal(missing.status, 401);
    assert.equal(missing.body.message, 'Session unavailable. Please sign in again.');
    assert.equal(expired.status, 401);
    assert.equal(expired.body.message, 'Session unavailable. Please sign in again.');
  } finally {
    RefreshSession.findOneAndUpdate = originalFindOneAndUpdate;
    RefreshSession.findOne = originalFindOne;
  }
});

test('refresh rotates a valid session and returns a new access token', { concurrency: false }, async () => {
  const [{ refreshSession }, { default: RefreshSession }] = await Promise.all([
    import('../controllers/authController.js'),
    import('../models/RefreshSession.js')
  ]);
  const originalFindOneAndUpdate = RefreshSession.findOneAndUpdate;
  const originalCreate = RefreshSession.create;
  const originalFindById = User.findById;
  const session = { _id: new mongoose.Types.ObjectId(), familyId: 'test-family', user: new mongoose.Types.ObjectId(), save: async () => {} };
  const user = { _id: session.user, email: 'student@satiengg.in', name: 'Student', role: 'student', tokenVersion: 0, accountStatus: 'active', accountType: 'student', emailVerified: true, createdAt: new Date() };
  let issuedSession;
  let replacementCookie;
  RefreshSession.findOneAndUpdate = async () => session;
  RefreshSession.create = async (data) => { issuedSession = data; return data; };
  User.findById = async () => user;
  try {
    const responsePromise = new Promise((resolve, reject) => {
      const req = { cookies: { refreshToken: 'old-refresh-token' }, get: () => 'test-agent', ip: '127.0.0.1' };
      const res = { cookie(_name, token) { replacementCookie = token; }, json(body) { resolve(body); }, clearCookie() {} };
      refreshSession(req, res, reject);
    });
    const response = await responsePromise;
    assert.equal(response.success, true);
    assert.equal(typeof response.token, 'string');
    assert.ok(replacementCookie);
    assert.equal(issuedSession.familyId, 'test-family');
    assert.equal(session.replacedBy, issuedSession.tokenHash);
  } finally {
    RefreshSession.findOneAndUpdate = originalFindOneAndUpdate;
    RefreshSession.create = originalCreate;
    User.findById = originalFindById;
  }
});

test('student registration stages a pending account and returns an opaque development mail capability', { concurrency: false }, async () => {
  const [{ createRegisterStudentHandler }, { env }] = await Promise.all([
    import('../controllers/authController.js'),
    import('../config/env.js')
  ]);
  const originalNodeEnv = env.nodeEnv;
  const originalEmailProvider = env.emailProvider;
  env.nodeEnv = 'development';
  env.emailProvider = 'resend';

  const payload = { name: 'Test Student', email: 'Student24cs012@SATIENGG.IN', enrollmentNumber: '0108CS241001', department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'A-secure-password-123', confirmPassword: 'A-secure-password-123' };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let savedPayload;
  let savedPending;
  let deliveredMessage;
  const duplicateQueries = [];
  try {
    await createRegisterStudentHandler({ deliverCode: async (message) => { deliveredMessage = message; return { previewToken: 'opaque-preview-capability' }; }, isDuplicate: async (query, collection) => { duplicateQueries.push({ query, collection }); return false; }, reserveEnrollment: async () => ({}), releaseEnrollment: async () => ({ deletedCount: 1 }), savePending: async (_filter, update) => { savedPayload = update.$set.payload; savedPending = update.$set; return { _id: 'verification-1', expiresAt: update.$set.expiresAt }; }, removePending: async () => ({ deletedCount: 0 }) })({ body: payload, requestId: 'registration-mail-test' }, res);
  } finally {
    env.nodeEnv = originalNodeEnv;
    env.emailProvider = originalEmailProvider;
  }
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.devOtp, undefined);
  assert.equal(res.body.devMailPreviewToken, 'opaque-preview-capability');
  assert.equal(savedPayload.email, 'student24cs012@satiengg.in');
  assert.equal(deliveredMessage.to, 'student24cs012@satiengg.in');
  assert.match(deliveredMessage.code, /^\d{6}$/);
  assert.equal(deliveredMessage.requestId, 'registration-mail-test');
  assert.equal(savedPayload.enrollmentNumber, '0108cs241001');
  assert.ok(savedPending.lastSentAt instanceof Date);
  assert.deepEqual(duplicateQueries[0], { query: { email: 'student24cs012@satiengg.in' }, collection: 'accountByEmail' });
  assert.deepEqual(duplicateQueries[1], { query: { enrollmentNumber: '0108cs241001' }, collection: 'accountByEnrollment' });
  assert.deepEqual(duplicateQueries[3].query['payload.enrollmentNumber'], '0108cs241001');
});

test('student signup does not issue an OTP when an atomic enrollment reservation is occupied', { concurrency: false }, async () => {
  const { createRegisterStudentHandler } = await import('../controllers/authController.js');
  let saved = false;
  let delivered = false;
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const payload = { name: 'Reserved Student', email: 'reserved24cs012@satiengg.in', enrollmentNumber: '0108cs241001', department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'A-secure-password-123', confirmPassword: 'A-secure-password-123' };
  await createRegisterStudentHandler({
    isDuplicate: async () => false,
    reserveEnrollment: async () => null,
    savePending: async () => { saved = true; },
    deliverCode: async () => { delivered = true; }
  })({ body: payload }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(saved, false);
  assert.equal(delivered, false);
});

test('verified duplicate student registration returns conflict and does not create another OTP', { concurrency: false }, async () => {
  const { createRegisterStudentHandler } = await import('../controllers/authController.js');
  let deliveryCalled = false;
  const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const payload = { name: 'Existing Student', email: 'existing24cs012@satiengg.in', enrollmentNumber: '0108cs241010', department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'A-secure-password-123', confirmPassword: 'A-secure-password-123' };
  await assert.rejects(createRegisterStudentHandler({
    isDuplicate: async (_query, collection) => collection === 'accountByEmail'
      ? { _id: 'existing-user', accountType: 'student', emailVerified: true, accountStatus: 'active' }
      : false,
    deliverCode: async () => { deliveryCalled = true; }
  })({ body: payload }, response), { status: 409, message: 'This email is already registered. Please log in.' });
  assert.equal(deliveryCalled, false);
});

test('unverified existing student resumes OTP verification without replacing credentials or profile', { concurrency: false }, async () => {
  const { createRegisterStudentHandler } = await import('../controllers/authController.js');
  let pendingPayload;
  let sentCode;
  let response;
  const existingAccount = { _id: 'legacy-unverified-user', emailVerified: false, accountType: 'student', accountStatus: 'active', password: 'existing-password-hash', name: 'Original Name' };
  const payload = { name: 'Submitted Replacement Name', email: 'LEGACY24CS012@SATIENGG.IN', enrollmentNumber: '0108cs241001', department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'A-different-password-123', confirmPassword: 'A-different-password-123' };
  response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createRegisterStudentHandler({
    isDuplicate: async (_query, collection) => {
      if (collection === 'accountByEmail') return existingAccount;
      if (collection === 'pendingEntry') return null;
      throw new Error(`Unexpected registration lookup: ${collection}`);
    },
    reserveEnrollment: async () => { throw new Error('Resumption must not reserve a new enrollment.'); },
    savePending: async (_filter, update) => { pendingPayload = update.$set.payload; return { _id: 'resume-pending', expiresAt: update.$set.expiresAt }; },
    deliverCode: async ({ to, code }) => { sentCode = { to, code }; return {}; }
  })({ body: payload, requestId: 'resume-test' }, response);

  assert.equal(response.statusCode, 202);
  assert.equal(sentCode.to, 'legacy24cs012@satiengg.in');
  assert.match(sentCode.code, /^\d{6}$/);
  assert.deepEqual(pendingPayload, { resumeUserId: 'legacy-unverified-user' });
  assert.equal(existingAccount.password, 'existing-password-hash');
  assert.equal(existingAccount.name, 'Original Name');
});

test('development mock OTP completes registration and email verification without an email provider', { concurrency: false }, async () => {
  const [{ createRegisterStudentHandler, verifyStudentEmail }, { sendVerificationCode }, { consumeDevelopmentMail }, { env }, { default: EmailVerification }, { default: EnrollmentReservation }, { default: RefreshSession }] = await Promise.all([
    import('../controllers/authController.js'),
    import('../utils/emailProvider.js'),
    import('../utils/devMailCapture.js'),
    import('../config/env.js'),
    import('../models/EmailVerification.js'),
    import('../models/EnrollmentReservation.js'),
    import('../models/RefreshSession.js')
  ]);
  const originals = {
    nodeEnv: env.nodeEnv,
    emailProvider: env.emailProvider,
    otpMockEnabled: env.otpMockEnabled,
    resendApiKey: env.resendApiKey,
    resendTestMode: env.resendTestMode,
    resendTestRecipient: env.resendTestRecipient,
    resendDomainVerified: env.resendDomainVerified,
    emailFrom: env.emailFrom,
    findOne: EmailVerification.findOne,
    findOneAndUpdate: EmailVerification.findOneAndUpdate,
    deleteOne: EmailVerification.deleteOne,
    reservationFindOne: EnrollmentReservation.findOne,
    reservationFindOneAndUpdate: EnrollmentReservation.findOneAndUpdate,
    reservationDeleteOne: EnrollmentReservation.deleteOne,
    userCreate: User.create,
    sessionCreate: RefreshSession.create
  };
  env.nodeEnv = 'development'; env.emailProvider = 'resend'; env.otpMockEnabled = true; env.resendApiKey = ''; env.resendTestMode = false; env.emailFrom = '';
  let pending;
  let createdUser;
  EmailVerification.findOne = async () => pending;
  EmailVerification.findOneAndUpdate = async (filter) => filter.otpHash === pending.otpHash ? pending : null;
  EmailVerification.deleteOne = async () => ({ deletedCount: 1 });
  EnrollmentReservation.findOne = async () => ({ email: pending.payload.email, enrollmentNumber: pending.payload.enrollmentNumber, expiresAt: pending.expiresAt });
  EnrollmentReservation.findOneAndUpdate = async (_filter, update) => ({ email: update.$set.email, enrollmentNumber: update.$set.enrollmentNumber });
  EnrollmentReservation.deleteOne = async () => ({ deletedCount: 1 });
  User.create = async (data) => { createdUser = { ...data, _id: new mongoose.Types.ObjectId(), tokenVersion: 0, createdAt: new Date() }; return createdUser; };
  RefreshSession.create = async () => ({ _id: new mongoose.Types.ObjectId() });

  try {
    const payload = { name: 'Mock Flow Student', email: 'flow24cs012@satiengg.in', enrollmentNumber: '0108cs241001', department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'A-secure-password-123', confirmPassword: 'A-secure-password-123' };
    const registerResponse = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createRegisterStudentHandler({
      deliverCode: sendVerificationCode,
      generateCode: () => '004219',
      isDuplicate: async () => false,
      reserveEnrollment: async () => ({}),
      releaseEnrollment: async () => ({ deletedCount: 1 }),
      savePending: async (_filter, update) => { pending = { _id: 'mock-pending-id', ...update.$set }; return pending; },
      removePending: async () => ({ deletedCount: 1 })
    })({ body: payload }, registerResponse);

    assert.equal(registerResponse.statusCode, 202);
    assert.equal(registerResponse.body.devOtp, undefined);
    assert.ok(registerResponse.body.devMailPreviewToken);
    const captured = consumeDevelopmentMail(registerResponse.body.devMailPreviewToken);
    assert.equal(captured.code, '004219');
    const verifyResponse = { cookie() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    const verifyPromise = new Promise((resolve, reject) => {
      verifyResponse.json = (body) => { verifyResponse.body = body; resolve(body); };
      verifyStudentEmail({ body: { email: payload.email, otp: captured.code }, get: () => 'test-agent', ip: '127.0.0.1' }, verifyResponse, reject);
    });
    const verified = await verifyPromise;
    assert.equal(verified.success, true);
    assert.equal(createdUser.email, payload.email);
    assert.equal(createdUser.emailVerified, true);
  } finally {
    env.nodeEnv = originals.nodeEnv; env.emailProvider = originals.emailProvider; env.otpMockEnabled = originals.otpMockEnabled; env.resendApiKey = originals.resendApiKey; env.resendTestMode = originals.resendTestMode; env.resendTestRecipient = originals.resendTestRecipient; env.resendDomainVerified = originals.resendDomainVerified; env.emailFrom = originals.emailFrom;
    EmailVerification.findOne = originals.findOne; EmailVerification.findOneAndUpdate = originals.findOneAndUpdate; EmailVerification.deleteOne = originals.deleteOne;
    EnrollmentReservation.findOne = originals.reservationFindOne; EnrollmentReservation.findOneAndUpdate = originals.reservationFindOneAndUpdate; EnrollmentReservation.deleteOne = originals.reservationDeleteOne;
    User.create = originals.userCreate; RefreshSession.create = originals.sessionCreate;
  }
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
      const res = { calls: 0, json(body) { this.calls += 1; this.body = body; } };
      let error;
      await createLoginHandler({ createSession: async (loggedUser) => ({ token: 'short-lived-access', user: { id: loggedUser._id.toString(), email: loggedUser.email } }), findUser: async () => user })({ body: { email: user.email, password }, get: () => '' }, res, (value) => { error = value; });
      return error ? { status: error.status, calls: res.calls } : { status: 200, body: res.body, calls: res.calls };
    };
    const valid = await run('A-secure-password-123');
    const invalid = await run('incorrect-password');

    assert.equal(valid.status, 200);
    assert.equal(valid.calls, 1);
    assert.equal(typeof valid.body.token, 'string');
    assert.equal(invalid.status, 401);
    assert.equal(invalid.calls, 0);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('login sends one response on success and one error response when session persistence fails', { concurrency: false }, async () => {
  const { createLoginHandler } = await import('../controllers/authController.js');
  const { errorHandler } = await import('../middleware/errorMiddleware.js');
  const user = { _id: new mongoose.Types.ObjectId(), name: 'Login Student', email: 'login@satiengg.in', enrollmentNumber: '0108cs241001', password: await bcrypt.hash('A-secure-password-123', 10), role: 'student', accountType: 'student', accountStatus: 'active', emailVerified: true, createdAt: new Date(), interests: [], skills: [] };

  const successResponse = { sends: 0, json(body) { this.sends += 1; this.body = body; } };
  await createLoginHandler({ createSession: async () => ({ token: 'opaque-access-token', user: { id: user._id } }), findUser: async () => user })({ body: { email: user.email, password: 'A-secure-password-123' }, requestId: 'login-success' }, successResponse, () => {});
  assert.equal(successResponse.sends, 1);
  assert.equal(successResponse.body.success, true);

  let error;
  await createLoginHandler({ createSession: async () => { throw new Error('session persistence failed'); }, findUser: async () => user })({ body: { email: user.email, password: 'A-secure-password-123' }, requestId: 'login-storage-failure' }, {}, (value) => { error = value; });
  const failedResponse = { sends: 0, headersSent: false, status(code) { this.statusCode = code; return this; }, json(body) { this.sends += 1; this.body = body; } };
  const original = console.error;
  let logLine;
  console.error = (...args) => { logLine = args; };
  try {
    errorHandler(error, { requestId: 'login-storage-failure' }, failedResponse, () => {});
    assert.equal(failedResponse.sends, 1);
    assert.equal(failedResponse.statusCode, 500);
    assert.equal(failedResponse.body.message, 'Unable to start a session. Please retry.');
    assert.equal(logLine[0], '[login-storage-failure]');
    assert.match(logLine[1], /Unable to start a session/);
    assert.doesNotMatch(JSON.stringify(logLine), /session persistence failed/);
  } finally { console.error = original; }
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
  assert.throws(() => validateCollegeEmail('student@gmail.com'), { status: 400 });
  assert.throws(() => validateCollegeEmail('student27cs011@satiengg.in', { allowedDomains: [] }), { status: 400 });
  assert.doesNotThrow(() => validateCollegeEmail(' Student27CS011@SATIENGG.IN '));
});

test('SATI institutional email and enrollment formats accept all configured branch codes', async () => {
  const { validateStudentIdentity } = await import('../controllers/authController.js');
  const emailPattern = '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$';
  const enrollmentPattern = '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$';
  const branches = ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee'];

  for (const branch of branches) {
    const result = validateStudentIdentity({
      email: `STUDENT24${branch}012@SATIENGG.IN`,
      enrollmentNumber: `0108${branch}241001`,
      branch
    }, { allowedDomains: ['satiengg.in'], emailPattern, enrollmentPattern, allowedBranches: branches, production: true });
    assert.equal(result.email, `student24${branch}012@satiengg.in`);
    assert.equal(result.enrollmentNumber, `0108${branch}241001`);
    assert.equal(result.graduationYearCode, '24');
    assert.equal(result.branchCode, branch);
    assert.equal(result.emailRollNumber, '012');
  }
});

test('SATI institutional validation rejects invalid email/enrollment lengths, sections, branches and domains', async () => {
  const { validateStudentIdentity } = await import('../controllers/authController.js');
  const policy = {
    allowedDomains: ['satiengg.in'],
    emailPattern: '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$',
    enrollmentPattern: '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$',
    allowedBranches: ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee'],
    production: true
  };
  const valid = { email: 'student24cs012@satiengg.in', enrollmentNumber: '0108cs241001', branch: 'cs' };
  const invalidCases = [
    { email: 'student24cs012@example.com' },
    { email: 'student24cs012@satiengg.in.extra' },
    { email: 'student24cs1@satiengg.in' },
    { email: 'student24xx012@satiengg.in' },
    { email: 'student2cs012@satiengg.in' },
    { email: 'student24cs01@satiengg.in' },
    { enrollmentNumber: '0108cs241201' },
    { enrollmentNumber: '0108cs2410010' },
    { enrollmentNumber: '0108xx241001' },
    { enrollmentNumber: '0108cs24101' },
    { enrollmentNumber: '0108cs241001x' },
    { enrollmentNumber: '0108bc241001' },
    { branch: 'xx' },
    { email: 'not-an-email' }
  ];

  for (const override of invalidCases) {
    assert.throws(() => validateStudentIdentity({ ...valid, ...override }, policy), { status: 400 }, JSON.stringify(override));
  }
});
