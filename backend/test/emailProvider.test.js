import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
process.env.NODE_ENV = 'test';

const [{ env }, { createEmailProvider }, { captureDevelopmentMail, consumeDevelopmentMail }] = await Promise.all([
  import('../config/env.js'),
  import('../utils/emailProvider.js'),
  import('../utils/devMailCapture.js')
]);

const TEST_API_KEY = 'resend-test-api-key';
const TEST_SENDER = 'CampusSwap <onboarding@resend.dev>';
const TEST_RECIPIENT = 'delivered@resend.dev';

const createMockedSender = ({ config = {}, result = { data: { id: 'email-test-id' }, error: null }, thrownError } = {}) => {
  const calls = [];
  const configuration = {
    nodeEnv: 'development', otpMockEnabled: false, resendApiKey: TEST_API_KEY,
    emailFrom: TEST_SENDER, resendTestMode: true, resendTestRecipient: TEST_RECIPIENT,
    resendDomainVerified: false, ...config
  };
  const provider = createEmailProvider({
    configuration,
    logger: { info() {}, warn() {} },
    clientFactory: (key) => {
      assert.equal(key, TEST_API_KEY);
      return { emails: { send: async (...args) => {
        calls.push(args);
        if (thrownError) throw thrownError;
        return typeof result === 'function' ? result(...args) : result;
      } } };
    },
    captureMail: captureDevelopmentMail
  });
  return { provider, calls, configuration };
};

test('development mock OTP remains a one-use local capture with no provider configuration', async () => {
  const originalNodeEnv = env.nodeEnv;
  const originalEmailProvider = env.emailProvider;
  const originalMockEnabled = env.otpMockEnabled;
  env.nodeEnv = 'development';
  env.emailProvider = 'resend';
  env.otpMockEnabled = true;
  const mockProvider = createEmailProvider({ configuration: { ...env, nodeEnv: 'development', emailProvider: 'resend', otpMockEnabled: true, resendApiKey: '', emailFrom: '' }, logger: { info() {}, warn() {} } });
  try {
    const result = await mockProvider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' });
    assert.ok(result.previewToken);
    assert.equal(result.previewCode, undefined);
    assert.deepEqual(consumeDevelopmentMail(result.previewToken), { purpose: 'student-verification', code: '123456' });
    assert.equal(consumeDevelopmentMail(result.previewToken), null);
  } finally {
    env.nodeEnv = originalNodeEnv;
    env.emailProvider = originalEmailProvider;
    env.otpMockEnabled = originalMockEnabled;
  }
});

test('Resend test mode uses its permitted sender and recipient and passes a bounded abort signal', async () => {
  const { provider, calls } = createMockedSender();
  const result = await provider.sendVerificationCode({ to: 'student27cs011@satiengg.in', code: '123456' });
  assert.deepEqual(result, {});
  assert.equal(calls.length, 1);
  const [message, options] = calls[0];
  assert.deepEqual(message.to, [TEST_RECIPIENT]);
  assert.equal(message.from, TEST_SENDER);
  assert.equal(message.subject, 'Verify your CampusSwap account');
  assert.match(message.text, /123456/);
  assert.ok(options.signal instanceof AbortSignal);
});

test('Gmail selection sends only through mocked Gmail SMTP even with no Resend configuration', async () => {
  const smtpCalls = [];
  const resendCalls = [];
  const logs = [];
  const configuration = {
    nodeEnv: 'development', emailProvider: 'gmail', otpMockEnabled: true,
    gmailUser: 'demo@gmail.com', gmailAppPassword: 'sixteen-char-app',
    emailFrom: 'CampusSwap <demo@gmail.com>', resendApiKey: '', resendTestMode: true,
    resendDomainVerified: false
  };
  const provider = createEmailProvider({
    configuration,
    logger: {
      info: (line) => logs.push(JSON.parse(line)),
      warn: (line) => logs.push(JSON.parse(line))
    },
    clientFactory: async () => { resendCalls.push(true); throw new Error('Resend must not initialize'); },
    transportFactory: (options) => {
      assert.deepEqual(options, { service: 'gmail', auth: { user: 'demo@gmail.com', pass: 'sixteen-char-app' } });
      return {
        sendMail: async (message) => { smtpCalls.push(message); return { messageId: 'mock-id', accepted: [message.to], rejected: [], response: '250 2.0.0 OK' }; },
        verify: async () => true
      };
    }
  });
  await provider.sendVerificationCode({ to: 'student27cs011@satiengg.in', code: '123456', requestId: 'smtp-registration-test' });
  await provider.sendPasswordResetCode({ to: 'student27cs011@satiengg.in', code: '654321', requestId: 'smtp-reset-test' });
  assert.equal(await provider.verifyConnection(), true);
  assert.equal(smtpCalls.length, 2);
  assert.equal(smtpCalls[0].to, 'student27cs011@satiengg.in');
  assert.match(smtpCalls[0].text, /123456/);
  assert.match(smtpCalls[1].text, /654321/);
  assert.deepEqual(resendCalls, []);
  assert.deepEqual(logs.map((entry) => entry.event), [
    'auth_email_send_attempted', 'auth_email_smtp_accepted',
    'auth_email_send_attempted', 'auth_email_smtp_accepted'
  ]);
  assert.equal(logs[1].smtpResponseCode, 250);
  assert.equal(logs[0].provider, 'gmail');
  assert.equal(logs[0].requestId, 'smtp-registration-test');
  assert.equal(JSON.stringify(logs).includes('123456'), false);
  assert.equal(JSON.stringify(logs).includes('student27cs011@satiengg.in'), false);
  assert.equal(JSON.stringify(logs).includes(configuration.gmailAppPassword), false);
});

test('Gmail resolves no-accepted-recipient responses as delivery failures with sanitized logs', async () => {
  const logs = [];
  const configuration = { nodeEnv: 'development', emailProvider: 'gmail', gmailUser: 'demo@gmail.com', gmailAppPassword: 'sixteen-char-app', emailFrom: 'demo@gmail.com' };
  const provider = createEmailProvider({
    configuration,
    logger: { info: (line) => logs.push(JSON.parse(line)), warn: (line) => logs.push(JSON.parse(line)) },
    transportFactory: () => ({ sendMail: async () => ({ accepted: [], rejected: ['student27cs011@satiengg.in'] }) })
  });
  await assert.rejects(provider.sendVerificationCode({ to: 'student27cs011@satiengg.in', code: '789123', requestId: 'smtp-rejected-test' }), /Email delivery failed/);
  assert.deepEqual(logs.map((entry) => entry.event), ['auth_email_send_attempted', 'auth_email_smtp_rejected']);
  assert.equal(logs[1].failureCategory, 'smtp_recipient_rejected');
  assert.equal(JSON.stringify(logs).includes('789123'), false);
  assert.equal(JSON.stringify(logs).includes('student27cs011@satiengg.in'), false);
});

test('Gmail authentication failure is sanitized and missing credentials fail without transport creation', async () => {
  const secret = 'mock-private-provider-response';
  const configuration = { nodeEnv: 'development', emailProvider: 'gmail', gmailUser: 'demo@gmail.com', gmailAppPassword: 'sixteen-char-app', emailFrom: 'demo@gmail.com', resendApiKey: '' };
  const provider = createEmailProvider({ configuration, logger: { info() {}, warn() {} }, transportFactory: () => ({ sendMail: async () => { throw Object.assign(new Error(secret), { code: 'EAUTH' }); }, verify: async () => { throw new Error(secret); } }) });
  await assert.rejects(provider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), (error) => {
    assert.match(error.message, /Email delivery failed/);
    assert.equal(error.message.includes(secret), false);
    assert.equal(error.message.includes(configuration.gmailAppPassword), false);
    return true;
  });
  await assert.rejects(provider.verifyConnection(), /connection verification failed/i);
  const missing = createEmailProvider({ configuration: { ...configuration, gmailAppPassword: '' }, transportFactory: () => { throw new Error('must not initialize'); } });
  await assert.rejects(missing.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), /not configured/i);
});

test('Resend email content supports registration resend, password reset, alumni verification and password-change notices', async () => {
  const { provider, calls } = createMockedSender();
  await provider.sendVerificationCode({ to: 'student27cs011@satiengg.in', code: '654321' });
  await provider.sendPasswordReset({ to: 'student27cs011@satiengg.in', resetUrl: 'https://web.example/reset#token=opaque' });
  await provider.sendPasswordReset({ to: 'alumni@example.com', resetUrl: 'https://web.example/verify#token=alumni', template: 'campusswap-alumni-email-verification' });
  await provider.sendPasswordChangedConfirmation({ to: 'student27cs011@satiengg.in' });

  assert.equal(calls.length, 4);
  assert.equal(calls[1][0].subject, 'Reset your CampusSwap password');
  assert.match(calls[1][0].html, /href="https:\/\/web\.example\/reset#token=opaque"/);
  assert.equal(calls[2][0].subject, 'Verify your CampusSwap alumni email');
  assert.equal(calls[3][0].subject, 'Your CampusSwap password was changed');
});

test('HTML email content escapes provider-bound values', async () => {
  const { provider, calls } = createMockedSender();
  await provider.sendPasswordReset({ to: 'test@example.com', resetUrl: 'https://example.test/?x=1&y=<script>' });
  assert.match(calls[0][0].html, /&amp;y=&lt;script&gt;/);
});

test('missing API configuration fails safely without leaking credentials', async () => {
  const { provider } = createMockedSender({ config: { resendApiKey: '' } });
  await assert.rejects(provider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), /not configured/i);
});

test('Resend SDK error responses and transport exceptions become generic delivery failures', async () => {
  const rejected = createMockedSender({ result: { data: null, error: { message: `private ${TEST_API_KEY} response`, statusCode: 403 } } });
  await assert.rejects(rejected.provider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), (error) => {
    assert.equal(error.message, 'Email delivery failed. Check server-side provider status using the request ID.');
    assert.equal(error.message.includes(TEST_API_KEY), false);
    return true;
  });

  const timedOut = createMockedSender({ thrownError: new DOMException('request timed out', 'TimeoutError') });
  await assert.rejects(timedOut.provider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), /Email delivery failed/);
});

test('unverified production domain disables provider sends even when credentials exist', async () => {
  const { provider, calls } = createMockedSender({ config: { nodeEnv: 'production', resendDomainVerified: false, resendTestMode: false } });
  await assert.rejects(provider.sendVerificationCode({ to: 'student@satiengg.in', code: '123456' }), /unavailable until the Resend sending domain is verified/);
  assert.equal(calls.length, 0);
});

const loadEnvironment = (overrides = {}) => spawnSync(process.execPath, ['--input-type=module', '-e', "import('./config/env.js')"], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: {
    ...process.env,
    JWT_SECRET: 'x'.repeat(64),
    NODE_ENV: 'production',
    OTP_MOCK_ENABLED: 'false',
    OTP_PEPPER: 'p'.repeat(64),
    TRUST_PROXY_HOPS: '1',
    FRONTEND_URL: 'https://web.example',
    RESEND_DOMAIN_VERIFIED: 'false',
    RESEND_TEST_MODE: 'false',
    EMAIL_PROVIDER: 'resend',
    GMAIL_USER: '',
    GMAIL_APP_PASSWORD: '',
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    ...overrides
  }
});

test('production can start with unverified sending disabled, and verified sending requires a non-onboarding sender', () => {
  const pendingDns = loadEnvironment({ RESEND_API_KEY: TEST_API_KEY, EMAIL_FROM: 'CampusSwap <no-reply@satiengg.in>' });
  assert.equal(pendingDns.status, 0, pendingDns.stderr);

  const missingConfig = loadEnvironment({ RESEND_DOMAIN_VERIFIED: 'true' });
  assert.notEqual(missingConfig.status, 0);
  assert.match(missingConfig.stderr, /Verified production Resend delivery requires/);

  const onboardingSender = loadEnvironment({ RESEND_DOMAIN_VERIFIED: 'true', RESEND_API_KEY: TEST_API_KEY, EMAIL_FROM: TEST_SENDER });
  assert.notEqual(onboardingSender.status, 0);
  assert.match(onboardingSender.stderr, /verified EMAIL_FROM sender/);

  const verifiedSender = loadEnvironment({ RESEND_DOMAIN_VERIFIED: 'true', RESEND_API_KEY: TEST_API_KEY, EMAIL_FROM: 'CampusSwap <no-reply@satiengg.in>' });
  assert.equal(verifiedSender.status, 0, verifiedSender.stderr);
});

test('Resend onboarding test configuration is restricted to development and permitted sender/recipient values', () => {
  const base = {
    NODE_ENV: 'development', OTP_MOCK_ENABLED: 'false', RESEND_TEST_MODE: 'true',
    RESEND_API_KEY: TEST_API_KEY, EMAIL_FROM: TEST_SENDER, RESEND_TEST_RECIPIENT: TEST_RECIPIENT
  };
  const allowed = loadEnvironment({ ...base, NODE_ENV: 'development' });
  assert.equal(allowed.status, 0, allowed.stderr);

  const productionTestMode = loadEnvironment({ ...base, NODE_ENV: 'production' });
  assert.notEqual(productionTestMode.status, 0);
  assert.match(productionTestMode.stderr, /RESEND_TEST_MODE/);

  const invalidRecipient = loadEnvironment({ ...base, NODE_ENV: 'development', RESEND_TEST_RECIPIENT: 'student@example.com' });
  assert.notEqual(invalidRecipient.status, 0);
  assert.match(invalidRecipient.stderr, /RESEND_TEST_MODE|RESEND_TEST_RECIPIENT/);
});

test('provider environment validation is isolated by selected provider', () => {
  const gmailOnly = {
    NODE_ENV: 'development', EMAIL_PROVIDER: 'gmail', OTP_MOCK_ENABLED: 'false',
    GMAIL_USER: 'demo@gmail.com', GMAIL_APP_PASSWORD: '1234567890abcdef', EMAIL_FROM: 'CampusSwap <demo@gmail.com>',
    RESEND_API_KEY: '', RESEND_TEST_MODE: 'true', RESEND_DOMAIN_VERIFIED: 'false'
  };
  const gmail = loadEnvironment(gmailOnly);
  assert.equal(gmail.status, 0, gmail.stderr);

  const missingGmail = loadEnvironment({ ...gmailOnly, GMAIL_APP_PASSWORD: '' });
  assert.notEqual(missingGmail.status, 0);
  assert.match(missingGmail.stderr, /Gmail email delivery requires/);

  const resend = loadEnvironment({ NODE_ENV: 'development', EMAIL_PROVIDER: 'resend', OTP_MOCK_ENABLED: 'false', RESEND_API_KEY: TEST_API_KEY, EMAIL_FROM: TEST_SENDER, RESEND_TEST_MODE: 'false' });
  assert.equal(resend.status, 0, resend.stderr);
  const missingResend = loadEnvironment({ NODE_ENV: 'development', EMAIL_PROVIDER: 'resend', OTP_MOCK_ENABLED: 'false', RESEND_API_KEY: '', EMAIL_FROM: '', RESEND_TEST_MODE: 'false' });
  assert.notEqual(missingResend.status, 0);
});
