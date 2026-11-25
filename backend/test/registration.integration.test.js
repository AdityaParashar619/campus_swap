import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import test from 'node:test';

const testMongoUri = process.env.TEST_MONGO_URI || '';
if (testMongoUri) {
  const databaseName = new URL(testMongoUri).pathname.replace(/^\//, '').split('?')[0];
  if (!/_test$/i.test(databaseName)) throw new Error('TEST_MONGO_URI must target a database whose name ends with _test.');
}

process.env.JWT_SECRET = 'isolated-registration-integration-test-secret';
process.env.NODE_ENV = 'development';
process.env.OTP_MOCK_ENABLED = 'true';
process.env.EMAIL_PROVIDER = 'resend';
process.env.RESEND_API_KEY = '';
process.env.RESEND_TEST_MODE = 'false';
process.env.RESEND_DOMAIN_VERIFIED = 'false';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ALLOWED_COLLEGE_DOMAINS = 'satiengg.in';
process.env.INSTITUTION_EMAIL_PATTERN = '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$';
process.env.ENROLLMENT_PATTERN = '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$';
process.env.INSTITUTION_BRANCHES = 'cs,bc,ai,ds,it,iot,ec,ce,me,ee';
process.env.RATE_LIMIT_MAX = '1000';

const [{ default: mongoose }, { createApp }, { default: User }, { default: EmailVerification }, { default: EnrollmentReservation }, { default: RefreshSession }] = await Promise.all([
  import('mongoose'),
  import('../app.js'),
  import('../models/User.js'),
  import('../models/EmailVerification.js'),
  import('../models/EnrollmentReservation.js'),
  import('../models/RefreshSession.js')
]);
const { env } = await import('../config/env.js');
const { facultyUnexpectedIdentityFilter } = await import('../utils/institutionalIdentity.js');
const { consumeDevelopmentMail } = await import('../utils/devMailCapture.js');
const { authAttemptLimiter } = await import('../middleware/securityMiddleware.js');

test('Mongo-backed student registration, verification, login, refresh, logout, recovery and role permissions', { skip: !testMongoUri }, async () => {
  const suffix = crypto.randomBytes(8).toString('hex').replace(/[0-9]/g, 'q');
  const roll = crypto.randomInt(0, 100).toString().padStart(2, '0');
  const email = `integration${suffix}24cs0${roll}@satiengg.in`;
  const enrollmentNumber = `0108cs2410${roll}`;
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.createIndexes(), EmailVerification.createIndexes(), EnrollmentReservation.createIndexes(), RefreshSession.createIndexes()]);
  const [userIndexes, verificationIndexes, reservationIndexes, sessionIndexes] = await Promise.all([
    User.collection.indexes(), EmailVerification.collection.indexes(), EnrollmentReservation.collection.indexes(), RefreshSession.collection.indexes()
  ]);
  assert.ok(userIndexes.some((index) => index.name === 'email_1' && index.unique));
  assert.ok(userIndexes.some((index) => index.name === 'enrollmentNumber_1' && index.unique));
  assert.ok(verificationIndexes.some((index) => index.name === 'email_1_kind_1' && index.unique));
  assert.ok(reservationIndexes.some((index) => index.name === 'email_1' && index.unique));
  assert.ok(reservationIndexes.some((index) => index.name === 'enrollmentNumber_1' && index.unique));
  assert.ok(reservationIndexes.some((index) => index.name === 'expiresAt_1' && index.expireAfterSeconds === 0));
  assert.ok(sessionIndexes.some((index) => index.name === 'tokenHash_1' && index.unique));
  const server = createServer(createApp());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const originalFacultyConfig = { facultyDemoMode: env.facultyDemoMode, adminEmail: env.adminEmail, pilotModeEnabled: env.pilotModeEnabled, pilotAllowedEmails: env.pilotAllowedEmails };
  const facultyAdminEmail = 'faculty' + suffix + '27cs021@satiengg.in';
  Object.assign(env, { facultyDemoMode: true, adminEmail: facultyAdminEmail, pilotModeEnabled: false, pilotAllowedEmails: ['former27cs777@satiengg.in'] });
  const apiUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  let ownedUserId;
  let ownedAdminId;
  let ownedAdminEmail;
  let ownedLegacyId;
  let ownedLegacyEmail;
  let ownedConcurrentEmail;
  let ownedConcurrentId;
  let ownedVerificationId;
  let ownedReservationId;

  const resetAuthAttemptIpLimit = () => {
    authAttemptLimiter.resetKey('127.0.0.1');
    authAttemptLimiter.resetKey('::ffff:127.0.0.1');
  };

  try {
    assert.equal(await User.exists({ $or: [{ email }, { enrollmentNumber }] }), null, 'randomized test fixture must not already exist');
    assert.equal(await EmailVerification.exists({ email }), null);
    assert.equal(await EnrollmentReservation.exists({ email }), null);
    const register = (body) => fetch(apiUrl + '/register/student', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await register({ email: 'student@example.invalid' })).status, 400);
    assert.equal((await register({ email: 'malformed@satiengg.in' })).status, 400);
    assert.equal((await register({ email: facultyAdminEmail.toUpperCase() })).status, 403);
    assert.equal(await EmailVerification.exists({ email: facultyAdminEmail }), null);
    resetAuthAttemptIpLimit();
    const registration = await fetch(`${apiUrl}/register/student`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OTP Integration Student', email, enrollmentNumber, department: 'CSE', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'Integration-test-password-123', confirmPassword: 'Integration-test-password-123' })
    });
    const registrationBody = await registration.json();
    ownedVerificationId = (await EmailVerification.findOne({ email, kind: 'student' }).select('_id'))?._id;
    ownedReservationId = (await EnrollmentReservation.findOne({ email }).select('_id'))?._id;
    assert.equal(registration.status, 202, JSON.stringify(registrationBody));
    assert.equal(registrationBody.devOtp, undefined);
    assert.ok(registrationBody.devMailPreviewToken);
    assert.equal(await User.exists({ email }), null);
    assert.ok(await EmailVerification.exists({ email, kind: 'student' }));

    const preview = await fetch(`${apiUrl}/dev-mail-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewToken: registrationBody.devMailPreviewToken })
    });
    const previewBody = await preview.json();
    assert.equal(preview.status, 200, JSON.stringify(previewBody));
    assert.match(previewBody.code, /^\d{6}$/);
    const verification = await fetch(`${apiUrl}/verify-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, otp: previewBody.code })
    });
    const verificationBody = await verification.json();
    assert.equal(verification.status, 201, JSON.stringify(verificationBody));
    assert.equal(verificationBody.user.email, email);
    assert.equal(verificationBody.user.emailVerified, true);
    const createdUser = await User.findOne({ email, emailVerified: true, accountStatus: 'active' });
    assert.ok(createdUser);
    assert.equal(createdUser.enrollmentNumber, enrollmentNumber);
    assert.equal(createdUser.department, 'CSE');
    assert.equal(createdUser.branch, 'cs');
    assert.equal(createdUser.semester, '1');
    ownedUserId = createdUser._id;
    assert.ok(await RefreshSession.exists({ user: ownedUserId, revokedAt: null }));
    assert.equal(await EmailVerification.exists({ email, kind: 'student' }), null);
    assert.equal(await EnrollmentReservation.exists({ email }), null);

    resetAuthAttemptIpLimit();
    const duplicateRegistration = await fetch(`${apiUrl}/register/student`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase() })
    });
    const duplicateRegistrationBody = await duplicateRegistration.json();
    assert.equal(duplicateRegistration.status, 409);
    assert.equal(duplicateRegistrationBody.message, 'This email is already registered. Please log in.');
    assert.equal(await EmailVerification.exists({ email, kind: 'student' }), null);
    await assert.rejects(User.create({ name: 'Duplicate Email Fixture', email, password: await bcrypt.hash('Unique-index-password-123', 12) }), (error) => error.code === 11000);

    const login = await fetch(`${apiUrl}/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'Integration-test-password-123' })
    });
    const loginBody = await login.json();
    assert.equal(login.status, 200, JSON.stringify(loginBody));
    assert.equal(loginBody.user.email, email);
    assert.match(login.headers.get('set-cookie') || '', /refreshToken=/);
    const loginCookie = (login.headers.get('set-cookie') || '').split(';')[0];

    const profile = await fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${loginBody.token}` } });
    assert.equal(profile.status, 200);

    const refresh = await fetch(`${apiUrl}/refresh`, {
      method: 'POST', headers: { origin: 'http://localhost:5173', cookie: loginCookie }
    });
    const refreshBody = await refresh.json();
    assert.equal(refresh.status, 200, JSON.stringify(refreshBody));
    assert.equal(typeof refreshBody.token, 'string');
    const rotatedCookie = (refresh.headers.get('set-cookie') || '').split(';')[0];

    const logout = await fetch(`${apiUrl}/logout`, {
      method: 'POST', headers: { origin: 'http://localhost:5173', cookie: rotatedCookie }
    });
    assert.equal(logout.status, 200);
    const protectedAfterLogout = await fetch(`${apiUrl}/me`);
    assert.equal(protectedAfterLogout.status, 401);
    const loggedOutRefresh = await fetch(`${apiUrl}/refresh`, {
      method: 'POST', headers: { origin: 'http://localhost:5173', cookie: rotatedCookie }
    });
    assert.equal(loggedOutRefresh.status, 401);

    const forgot = await fetch(`${apiUrl}/forgot-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const forgotBody = await forgot.json();
    assert.equal(forgot.status, 200);
    assert.ok(forgotBody.devMailPreviewToken);
    const resetMail = await fetch(`${apiUrl}/dev-mail-preview`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewToken: forgotBody.devMailPreviewToken })
    });
    const resetMailBody = await resetMail.json();
    assert.equal(resetMailBody.purpose, 'password-reset');
    assert.match(resetMailBody.code, /^\d{6}$/);
    const authorizedReset = await fetch(`${apiUrl}/verify-reset-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, otp: resetMailBody.code })
    });
    const authorizedBody = await authorizedReset.json();
    assert.equal(authorizedReset.status, 200, JSON.stringify(authorizedBody));
    const resetAuthorization = authorizedBody.resetAuthorization;
    assert.ok(resetAuthorization);

    const reset = await fetch(`${apiUrl}/reset-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: resetAuthorization, password: 'Integration-new-password-456' })
    });
    assert.equal(reset.status, 200);
    const changedUser = await User.findById(ownedUserId);
    assert.ok(await bcrypt.compare('Integration-new-password-456', changedUser.password));
    assert.equal(await bcrypt.compare('Integration-test-password-123', changedUser.password), false);
    const newPasswordLogin = await fetch(`${apiUrl}/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Integration-new-password-456' })
    });
    assert.equal(newPasswordLogin.status, 200);
    const newPasswordBody = await newPasswordLogin.json();

    const forbiddenAdminApi = await fetch(`${apiUrl.replace('/api/auth', '/api/admin')}/overview`, {
      headers: { authorization: `Bearer ${newPasswordBody.token}` }
    });
    assert.equal(forbiddenAdminApi.status, 403);

    const adminEmail = facultyAdminEmail;
    const adminEnrollment = '0108cs7710' + roll;
    ownedAdminEmail = adminEmail;
    const admin = await User.create({
      name: 'Integration Administrator', email: adminEmail, enrollmentNumber: adminEnrollment,
      branch: 'cs', department: 'CSE', semester: '7', yearSemester: '7', contactVisibility: 'private',
      password: await bcrypt.hash('Integration-admin-password-456', 12), role: 'admin', accountType: 'staff',
      accountStatus: 'active', emailVerified: true, verificationStatus: 'verified'
    });
    ownedAdminId = admin._id;
    assert.equal(await User.countDocuments({ $and: [facultyUnexpectedIdentityFilter(), { _id: { $in: [ownedUserId, ownedAdminId] } }] }), 0);
    resetAuthAttemptIpLimit();
    const enrollmentConflict = await register({
      name: 'Enrollment Conflict Fixture', email: 'conflict' + suffix + '27cs031@satiengg.in',
      enrollmentNumber: adminEnrollment.toUpperCase(), department: 'CSE', branch: 'cs', semester: '7',
      phoneNumber: '1234567890', password: 'Fixture-test-password-123', confirmPassword: 'Fixture-test-password-123'
    });
    assert.equal(enrollmentConflict.status, 409);
    assert.match((await enrollmentConflict.json()).message, /enrollment number is already registered/i);
    resetAuthAttemptIpLimit();

    const adminForgot = await fetch(`${apiUrl}/forgot-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminEmail.toUpperCase() })
    });
    const adminForgotBody = await adminForgot.json();
    assert.equal(adminForgot.status, 200);
    assert.ok(adminForgotBody.devMailPreviewToken);
    const adminResetMailBody = consumeDevelopmentMail(adminForgotBody.devMailPreviewToken);
    assert.equal(adminResetMailBody.purpose, 'password-reset');
    assert.match(adminResetMailBody.code, /^\d{6}$/);
    // Keep production limiter settings intact while isolating the second flow
    // from the earlier requests made by this single integration test.
    authAttemptLimiter.resetKey('127.0.0.1');
    authAttemptLimiter.resetKey('::ffff:127.0.0.1');
    const adminOtpVerification = await fetch(`${apiUrl}/verify-reset-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, otp: adminResetMailBody.code })
    });
    const adminOtpVerificationBody = await adminOtpVerification.json();
    assert.equal(adminOtpVerification.status, 200, JSON.stringify(adminOtpVerificationBody));
    assert.ok(adminOtpVerificationBody.resetAuthorization);
    const adminPasswordReset = await fetch(`${apiUrl}/reset-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: adminOtpVerificationBody.resetAuthorization, password: 'Admin-reset-password-456' })
    });
    assert.equal(adminPasswordReset.status, 200);

    const adminLogin = await fetch(`${apiUrl}/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'Admin-reset-password-456' })
    });
    const adminLoginBody = await adminLogin.json();
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLoginBody));
    assert.equal(adminLoginBody.user.role, 'admin');
    const adminOverview = await fetch(`${apiUrl.replace('/api/auth', '/api/admin')}/overview`, {
      headers: { authorization: `Bearer ${adminLoginBody.token}` }
    });
    assert.equal(adminOverview.status, 200);

    ownedLegacyEmail = `legacy${suffix}24cs0${roll}@satiengg.in`;
    const originalLegacyPasswordHash = await bcrypt.hash('Original-legacy-password-123', 12);
    const legacyUser = await User.create({
      name: 'Original Legacy Student', email: ownedLegacyEmail, enrollmentNumber: `0108cs2411${roll}`,
      password: originalLegacyPasswordHash, accountType: 'student', role: 'student',
      emailVerified: false, verificationStatus: 'pending', accountStatus: 'active'
    });
    ownedLegacyId = legacyUser._id;
    resetAuthAttemptIpLimit();
    const resumedRegistration = await fetch(`${apiUrl}/register/student`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Submitted Replacement Name', email: ownedLegacyEmail.toUpperCase(), enrollmentNumber: `0108cs2410${roll}`, department: 'Engineering', branch: 'cs', semester: '1', phoneNumber: '9999999999', password: 'Submitted-Replacement-password-123', confirmPassword: 'Submitted-Replacement-password-123' })
    });
    const resumedBody = await resumedRegistration.json();
    assert.equal(resumedRegistration.status, 202);
    assert.ok(resumedBody.devMailPreviewToken);
    const resumedMail = consumeDevelopmentMail(resumedBody.devMailPreviewToken);
    assert.match(resumedMail.code, /^\d{6}$/);
    resetAuthAttemptIpLimit();
    const resumedVerification = await fetch(`${apiUrl}/verify-email`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ownedLegacyEmail.toUpperCase(), otp: resumedMail.code })
    });
    const resumedVerificationBody = await resumedVerification.json();
    assert.equal(resumedVerification.status, 201, JSON.stringify(resumedVerificationBody));
    const resumedAccount = await User.findById(ownedLegacyId);
    assert.equal(resumedAccount.name, 'Original Legacy Student');
    assert.equal(resumedAccount.password, originalLegacyPasswordHash);
    assert.equal(resumedAccount.emailVerified, true);
    assert.equal(await User.countDocuments({ email: ownedLegacyEmail }), 1);

    const concurrentRoll = String((Number(roll) + 1) % 100).padStart(2, '0');
    ownedConcurrentEmail = `parallel${suffix}24cs0${concurrentRoll}@satiengg.in`;
    const concurrentPayload = { name: 'Concurrent Registration', email: ownedConcurrentEmail, enrollmentNumber: `0108cs2410${concurrentRoll}`, department: 'CSE', branch: 'cs', semester: '1', phoneNumber: '1234567890', password: 'Parallel-test-password-123', confirmPassword: 'Parallel-test-password-123' };
    resetAuthAttemptIpLimit();
    const concurrentRegistrations = await Promise.all([1, 2].map(() => fetch(`${apiUrl}/register/student`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(concurrentPayload)
    })));
    const concurrentBodies = await Promise.all(concurrentRegistrations.map((response) => response.json()));
    assert.deepEqual(concurrentRegistrations.map((response) => response.status), [202, 202]);
    assert.equal(concurrentBodies.filter((body) => body.devMailPreviewToken).length, 1);
    assert.ok(await EmailVerification.exists({ email: ownedConcurrentEmail, kind: 'student' }));
    assert.ok(await EnrollmentReservation.exists({ email: ownedConcurrentEmail }));
    const concurrentCode = consumeDevelopmentMail(concurrentBodies.find((body) => body.devMailPreviewToken).devMailPreviewToken).code;
    resetAuthAttemptIpLimit();
    const concurrentVerifications = await Promise.all([1, 2].map(() => fetch(`${apiUrl}/verify-email`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ownedConcurrentEmail, otp: concurrentCode })
    })));
    assert.deepEqual(concurrentVerifications.map((response) => response.status).sort(), [201, 400]);
    const concurrentUser = await User.findOne({ email: ownedConcurrentEmail });
    assert.ok(concurrentUser);
    ownedConcurrentId = concurrentUser._id;
  } finally {
    Object.assign(env, originalFacultyConfig);
    await Promise.all([
      ...(ownedUserId ? [User.deleteOne({ _id: ownedUserId }), RefreshSession.deleteMany({ user: ownedUserId })] : []),
      ...(ownedAdminId ? [User.deleteOne({ _id: ownedAdminId }), RefreshSession.deleteMany({ user: ownedAdminId })] : []),
      ...(ownedAdminEmail ? [EmailVerification.deleteMany({ email: ownedAdminEmail })] : []),
      ...(ownedLegacyId ? [User.deleteOne({ _id: ownedLegacyId }), RefreshSession.deleteMany({ user: ownedLegacyId })] : []),
      ...(ownedLegacyEmail ? [EmailVerification.deleteMany({ email: ownedLegacyEmail }), EnrollmentReservation.deleteMany({ email: ownedLegacyEmail })] : []),
      ...(ownedConcurrentId ? [User.deleteOne({ _id: ownedConcurrentId }), RefreshSession.deleteMany({ user: ownedConcurrentId })] : []),
      ...(ownedConcurrentEmail ? [EmailVerification.deleteMany({ email: ownedConcurrentEmail }), EnrollmentReservation.deleteMany({ email: ownedConcurrentEmail })] : []),
      ...(ownedVerificationId ? [EmailVerification.deleteOne({ _id: ownedVerificationId })] : []),
      ...(ownedReservationId ? [EnrollmentReservation.deleteOne({ _id: ownedReservationId })] : [])
    ]);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }
});
