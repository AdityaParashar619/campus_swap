import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Resolve the backend's own .env regardless of whether Node starts from the
// repository root or the backend directory. Compose-provided process vars win.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const requiredVars = ['JWT_SECRET'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const demoMode = process.env.CAMPUSSWAP_DEMO_MODE === 'true';
const serveFrontend = process.env.SERVE_FRONTEND === 'true';
const emailProvider = (process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
const otpMockEnabled = process.env.OTP_MOCK_ENABLED === 'true';
const resendApiKey = process.env.RESEND_API_KEY || '';
const resendTestMode = process.env.RESEND_TEST_MODE === 'true';
const resendDomainVerified = process.env.RESEND_DOMAIN_VERIFIED === 'true';
const resendTestRecipient = (process.env.RESEND_TEST_RECIPIENT || 'delivered@resend.dev').trim().toLowerCase();
const emailFrom = process.env.EMAIL_FROM || '';
const gmailUser = process.env.GMAIL_USER || '';
const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
const mongoUri = process.env.MONGO_URI || (nodeEnv === 'production' ? '' : 'mongodb://127.0.0.1:27017/campusswap');
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';
const institutionEmailPattern = process.env.INSTITUTION_EMAIL_PATTERN || '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$';
const allowedCollegeDomains = (process.env.ALLOWED_COLLEGE_DOMAINS || 'satiengg.in').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const institutionBranches = (process.env.INSTITUTION_BRANCHES || 'cs,bc,ai,ds,it,iot,ec,ce,me,ee').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const enrollmentPattern = process.env.ENROLLMENT_PATTERN || '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$';
const configuredBranchSample = institutionBranches[0] || '';
const SATI_SUPPORTED_BRANCHES = new Set(['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee']);
const otpTtlMinutes = Number(process.env.OTP_TTL_MINUTES || 5);
const otpMaxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const otpResendCooldownSeconds = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || '';
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || '';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const configuredFrontendOrigins = frontendUrl.split(',').map((value) => value.trim()).filter(Boolean);
const frontendOrigins = Object.freeze([...new Set([
  ...configuredFrontendOrigins,
  ...(nodeEnv === 'development' ? ['http://localhost:8080', 'http://localhost:5173'] : [])
])]);
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
const productImageMaxCount = Number(process.env.PRODUCT_IMAGE_MAX_COUNT || 5);
const productImageMaxSizeMb = Number(process.env.PRODUCT_IMAGE_MAX_SIZE_MB || 5);
const otpPepper = process.env.OTP_PEPPER || (nodeEnv === 'production' ? '' : process.env.JWT_SECRET);
const pilotModeEnabled = process.env.PILOT_MODE_ENABLED === 'true';
const pilotAllowedEmails = (process.env.PILOT_ALLOWED_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
const adminBootstrapEnabled = process.env.ADMIN_BOOTSTRAP_ENABLED === 'true';

if (pilotModeEnabled && (!pilotAllowedEmails.length || new Set(pilotAllowedEmails).size !== pilotAllowedEmails.length || pilotAllowedEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) {
  throw new Error('PILOT_MODE_ENABLED requires a non-empty, unique, valid PILOT_ALLOWED_EMAILS list');
}
if (adminBootstrapEnabled && !adminEmail && !superAdminEmail) {
  throw new Error('ADMIN_BOOTSTRAP_ENABLED requires ADMIN_EMAIL or SUPER_ADMIN_EMAIL');
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
}
if (!Number.isInteger(productImageMaxCount) || productImageMaxCount < 1 || productImageMaxCount > 10) {
  throw new Error('PRODUCT_IMAGE_MAX_COUNT must be an integer from 1 to 10');
}
if (!Number.isFinite(productImageMaxSizeMb) || productImageMaxSizeMb < 1 || productImageMaxSizeMb > 20) {
  throw new Error('PRODUCT_IMAGE_MAX_SIZE_MB must be between 1 and 20');
}
if (!institutionBranches.length || institutionBranches.some((branch) => !SATI_SUPPORTED_BRANCHES.has(branch)) || new Set(institutionBranches).size !== institutionBranches.length) {
  throw new Error('INSTITUTION_BRANCHES must contain only unique supported SATI branch codes');
}
if (superAdminEmail && !superAdminPassword) {
  throw new Error('SUPER_ADMIN_PASSWORD is required when SUPER_ADMIN_EMAIL is configured');
}
if (superAdminEmail && adminEmail && superAdminEmail.trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
  throw new Error('ADMIN_EMAIL and SUPER_ADMIN_EMAIL must identify different accounts');
}
if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production');
}
if (nodeEnv === 'production' && otpMockEnabled) {
  throw new Error('OTP_MOCK_ENABLED must be false in production');
}
const senderAddress = emailFrom.match(/<([^<>]+)>/)?.[1] || emailFrom;
const validSenderAddress = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(senderAddress) && !/[\r\n]/.test(emailFrom);
const permittedResendTestRecipients = new Set(['delivered@resend.dev', 'bounced@resend.dev', 'complained@resend.dev']);
if (demoMode && (nodeEnv !== 'production' || !serveFrontend || emailProvider !== 'disabled' ||
    otpMockEnabled || resendTestMode || resendDomainVerified || resendApiKey || emailFrom || gmailUser || gmailAppPassword ||
    cloudinaryCloudName || cloudinaryApiKey || cloudinaryApiSecret || pilotModeEnabled || adminBootstrapEnabled ||
    process.env.SEED_ON_STARTUP === 'true' || process.env.CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED === 'true')) {
  throw new Error('Restricted demo requires production same-origin mode without mail, media credentials, evidence, pilot, seed or bootstrap');
}
if (!(demoMode && emailProvider === 'disabled') && !['gmail', 'resend'].includes(emailProvider)) throw new Error('EMAIL_PROVIDER must be either gmail or resend');
if (emailProvider === 'gmail') {
  if (!gmailUser || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailUser) || !gmailAppPassword || gmailAppPassword.length < 16 || !validSenderAddress) {
    throw new Error('Gmail email delivery requires valid GMAIL_USER, a 16-character GMAIL_APP_PASSWORD, and a valid EMAIL_FROM');
  }
} else if (resendTestMode) {
  if (!['development', 'test'].includes(nodeEnv) || otpMockEnabled) {
    throw new Error('RESEND_TEST_MODE is available only in development/test with OTP_MOCK_ENABLED=false');
  }
  if (!resendApiKey || !validSenderAddress || senderAddress.toLowerCase() !== 'onboarding@resend.dev' || !permittedResendTestRecipients.has(resendTestRecipient)) {
    throw new Error('Resend test mode requires RESEND_API_KEY, EMAIL_FROM=onboarding@resend.dev, and a permitted RESEND_TEST_RECIPIENT');
  }
} else if (nodeEnv === 'development' && !otpMockEnabled && (!resendApiKey || !validSenderAddress)) {
  throw new Error('Real email mode requires RESEND_API_KEY and a valid EMAIL_FROM; use RESEND_TEST_MODE for Resend onboarding tests');
}
if (emailProvider === 'resend' && nodeEnv === 'production' && resendDomainVerified) {
  if (!resendApiKey || !validSenderAddress || senderAddress.toLowerCase() === 'onboarding@resend.dev') {
    throw new Error('Verified production Resend delivery requires RESEND_API_KEY and a valid verified EMAIL_FROM sender');
  }
}
if (emailProvider === 'resend' && nodeEnv === 'production' && !otpMockEnabled && (!resendApiKey || !validSenderAddress)) {
  throw new Error('Production Resend mode requires RESEND_API_KEY and a valid EMAIL_FROM sender');
}
if (nodeEnv === 'production') {
  if (!mongoUri) throw new Error('Production requires an explicit MONGO_URI');
  try {
    const parsedMongoUri = new URL(mongoUri);
    const databaseName = parsedMongoUri.pathname.replace(/^\//, '').split('?')[0];
    if (demoMode && !/^campusswap_demo(?:_[a-z0-9]+)?$/.test(databaseName)) throw new Error('unsafe demo target');
    if (!['mongodb:', 'mongodb+srv:'].includes(parsedMongoUri.protocol) || !databaseName || /(?:^|_)(?:test|staging)(?:_|$)/i.test(databaseName)) {
      throw new Error('unsafe MongoDB target');
    }
  } catch {
    throw new Error('Production MONGO_URI must be a valid MongoDB URI with an explicit non-test database name');
  }
  if (emailProvider === 'resend' && !resendDomainVerified) {
    throw new Error('Production Resend delivery requires RESEND_DOMAIN_VERIFIED=true after DNS verification');
  }
  if (!demoMode && (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret)) {
    throw new Error('Production requires complete backend-only Cloudinary credentials');
  }
  if (!process.env.OTP_PEPPER || otpPepper.length < 32 || otpPepper === process.env.JWT_SECRET) {
    throw new Error('Production requires a separate OTP_PEPPER of at least 32 characters');
  }
  if (trustProxyHops < 1) {
    throw new Error('Production requires TRUST_PROXY_HOPS to match the trusted ingress proxy chain');
  }
  if (!configuredFrontendOrigins.length || configuredFrontendOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || parsed.origin !== origin;
    } catch { return true; }
  })) {
    throw new Error('Production FRONTEND_URL values must be valid HTTPS origins without paths or credentials');
  }
}

for (const [key, value, max] of [['OTP_TTL_MINUTES', otpTtlMinutes, 60], ['OTP_MAX_ATTEMPTS', otpMaxAttempts, 20], ['OTP_RESEND_COOLDOWN_SECONDS', otpResendCooldownSeconds, 3600]]) {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${key} must be an integer from 1 to ${max}`);
}
try {
  const matcher = new RegExp(institutionEmailPattern);
  if (matcher.global || matcher.sticky || !matcher.test(`student27${configuredBranchSample}011@satiengg.in`)) throw new Error('invalid institutional email pattern');
  const enrollmentMatcher = new RegExp(enrollmentPattern);
  if (enrollmentMatcher.global || enrollmentMatcher.sticky || !enrollmentMatcher.test(`0108${configuredBranchSample}271001`)) throw new Error('invalid enrollment pattern');
} catch {
  throw new Error('INSTITUTION_EMAIL_PATTERN and ENROLLMENT_PATTERN must be valid, non-stateful regular expressions matching the SATI identity formats');
}

export const env = {
  nodeEnv,
  demoMode,
  serveFrontend,
  port,
  mongoUri,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl,
  frontendOrigins,
  databaseConnectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 5000,
  databaseRetryIntervalMs: Number(process.env.DATABASE_RETRY_INTERVAL_MS) || 30000,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  refreshRateLimitMax: Number(process.env.REFRESH_RATE_LIMIT_MAX) || 10,
  seedOnStartup: process.env.SEED_ON_STARTUP === 'true',
  adminEmail,
  adminPassword,
  adminName: process.env.ADMIN_NAME || 'CampusSwap Admin',
  adminBootstrapEnabled,
  superAdminEmail,
  superAdminPassword,
  allowedCollegeDomains,
  institutionEmailPattern,
  enrollmentPattern,
  institutionDepartments: (process.env.INSTITUTION_DEPARTMENTS || '').split(',').map((value) => value.trim()).filter(Boolean),
  institutionBranches,
  institutionClubs: (process.env.INSTITUTION_CLUBS || '').split(',').map((value) => value.trim()).filter(Boolean),
  institutionSemesters: (process.env.INSTITUTION_SEMESTERS || '1,2,3,4,5,6,7,8').split(',').map((value) => value.trim()).filter(Boolean),
  otpPepper,
  otpMockEnabled,
  resendApiKey,
  resendTestMode,
  resendTestRecipient,
  resendDomainVerified,
  emailFrom,
  emailProvider,
  gmailUser,
  gmailAppPassword,
  otpTtlMinutes,
  otpMaxAttempts,
  otpResendCooldownSeconds,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  trustProxyHops,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  productImageMaxCount,
  productImageMaxSizeBytes: Math.floor(productImageMaxSizeMb * 1024 * 1024),
  productImagePendingTtlMs: 24 * 60 * 60 * 1000,
  pilotModeEnabled,
  pilotAllowedEmails
};
