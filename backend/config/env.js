import dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['JWT_SECRET'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production');
}
if (process.env.NODE_ENV === 'production' && process.env.OTP_MOCK_ENABLED === 'true') {
  throw new Error('OTP_MOCK_ENABLED must be false in production');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusswap',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseConnectTimeoutMs: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) || 5000,
  databaseRetryIntervalMs: Number(process.env.DATABASE_RETRY_INTERVAL_MS) || 30000,
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  seedOnStartup: process.env.SEED_ON_STARTUP === 'true',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminName: process.env.ADMIN_NAME || 'CampusSwap Admin',
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || '',
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || '',
  allowedCollegeDomains: (process.env.ALLOWED_COLLEGE_DOMAINS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
  enrollmentPattern: process.env.ENROLLMENT_PATTERN || '',
  institutionDepartments: (process.env.INSTITUTION_DEPARTMENTS || '').split(',').map((value) => value.trim()).filter(Boolean),
  institutionBranches: (process.env.INSTITUTION_BRANCHES || '').split(',').map((value) => value.trim()).filter(Boolean),
  institutionClubs: (process.env.INSTITUTION_CLUBS || '').split(',').map((value) => value.trim()).filter(Boolean),
  institutionSemesters: (process.env.INSTITUTION_SEMESTERS || '1,2,3,4,5,6,7,8').split(',').map((value) => value.trim()).filter(Boolean),
  otpPepper: process.env.OTP_PEPPER || process.env.JWT_SECRET,
  otpMockEnabled: process.env.OTP_MOCK_ENABLED === 'true',
  emailProviderUrl: process.env.EMAIL_PROVIDER_URL || '',
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY || '',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30
};
