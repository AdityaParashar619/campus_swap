import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import { mockIssueCloudinary } from './campusIssueCloudinaryMock.js';

const uri = process.env.CAMPUS_ISSUE_E4_BROWSER_MONGO_URI;
assert.match(uri ?? '', /^mongodb:\/\/127\.0\.0\.1:27019\/campusswap_e4_browser(?:_[a-z0-9]+)?_test$/);
const db = new URL(uri).pathname.slice(1);
const cloud = 'campusswap-e4-browser-mock';
Object.assign(process.env, {
  NODE_ENV: 'development', MONGO_URI: uri, JWT_SECRET: 'isolated-e4-browser-authorization-key',
  OTP_PEPPER: 'isolated-e4-browser-otp-key', EMAIL_PROVIDER: 'resend', RESEND_TEST_MODE: 'false',
  OTP_MOCK_ENABLED: 'true', FRONTEND_URL: 'http://127.0.0.1:8094',
  ADMIN_BOOTSTRAP_ENABLED: 'false', PILOT_MODE_ENABLED: 'false', SEED_ON_STARTUP: 'false',
  ACCESS_TOKEN_TTL: '15m', RATE_LIMIT_MAX: '2000', AUTH_RATE_LIMIT_MAX: '2000', REFRESH_RATE_LIMIT_MAX: '2000',
  CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: 'e4-browser-fake-key', CLOUDINARY_API_SECRET: 'e4-browser-fake-secret',
  CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED: 'true', CAMPUS_ISSUE_TEST_DELETE_ENABLED: 'true', CAMPUS_ISSUE_TEST_DATABASE: db
});
const [{ httpServer }, { default: User }, { default: CampusIssue }] = await Promise.all([
  import('../server.js'), import('../models/User.js'), import('../models/CampusIssue.js')
]);
await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
try {
  assert.equal(await User.estimatedDocumentCount(), 0, 'Use a fresh disposable browser database');
  const provider = mockIssueCloudinary();
  const password = await bcrypt.hash('Pilot-Test-Password!27', 10);
  const corsPassword = await bcrypt.hash('Cors-Proxy-Test!27', 10);
  const [owner] = await User.create([
    { name: 'E4 Owner', email: 'e4-owner@satiengg.in', accountType: 'student', role: 'student' },
    { name: 'E4 Other', email: 'e4-other@satiengg.in', accountType: 'student', role: 'student' },
    { name: 'E4 Admin', email: 'e4-admin@satiengg.in', accountType: 'staff', role: 'admin' },
    { name: 'Pilot Admin', email: 'e2e-admin@satiengg.in', accountType: 'staff', role: 'admin' },
    { name: 'CORS Admin', email: 'cors-smoke-admin@satiengg.in', accountType: 'staff', role: 'admin', password: corsPassword }
  ].map((user) => ({ password, emailVerified: true, verificationStatus: 'verified', accountStatus: 'active', ...user })));

  const base = { createdBy: owner._id, category: 'water', description: 'Disposable browser fixture.' };
  const daysAgo = (days) => new Date(Date.now() - days * 86_400_000);
  const photo = await sharp({ create: { width: 10, height: 6, channels: 3, background: 'teal' } }).webp().toBuffer();
  const evidence = () => ({
    evidenceId: new mongoose.Types.ObjectId(), storageKey: new mongoose.Types.ObjectId(),
    mediaType: 'image/webp', sizeBytes: photo.length, uploadedAt: new Date()
  });
  for (const [title, fields] of [
    ['E4 recent closed fixture', { status: 'closed', closedAt: daysAgo(2) }],
    ['E4 historical resolved fixture', { status: 'resolved', resolvedAt: daysAgo(9) }],
    ['E4 historical closed fixture', { status: 'closed', closedAt: daysAgo(9) }],
    ['E4 marked cleanup fixture', { testFixture: true }]
  ]) {
    const attachment = evidence();
    const issue = await CampusIssue.create({ ...base, title, ...fields, attachments: [attachment], evidenceCloud: cloud });
    provider.assets.set(`campusswap/campus-issues/evidence/${issue.id}/${attachment.storageKey}`, photo);
  }
  await new Promise((resolve, reject) => httpServer.listen(5194, '127.0.0.1', resolve).once('error', reject));
  console.log('Campus Issues browser fixtures ready on 127.0.0.1:5194.');
} catch (error) {
  await mongoose.disconnect();
  throw error;
}
