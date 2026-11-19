import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const ensureAdminUser = async () => {
  if (!env.adminBootstrapEnabled) return;
  const bootstrapEmail = env.superAdminEmail || env.adminEmail;
  const bootstrapPassword = env.superAdminPassword || env.adminPassword;
  if (!bootstrapEmail || !bootstrapPassword) return;

  const email = bootstrapEmail.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    throw new Error('Administrator bootstrap refused: the configured email already exists. Disable bootstrap and verify the existing account manually.');
  }

  await User.create({
    name: env.adminName,
    email,
    enrollmentNumber: `ADMIN-${Date.now()}`,
    password: await bcrypt.hash(bootstrapPassword, 12),
    role: env.superAdminEmail ? 'super_admin' : 'admin',
    accountType: 'staff',
    accountStatus: 'active',
    emailVerified: true,
    verificationStatus: 'verified',
    isVerifiedStudent: true
  });

  console.log(`Admin user created: ${email}`);
};
