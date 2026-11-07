import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const ensureAdminUser = async () => {
  const bootstrapEmail = env.superAdminEmail || env.adminEmail;
  const bootstrapPassword = env.superAdminPassword || env.adminPassword;
  if (!bootstrapEmail || !bootstrapPassword) return;

  const email = bootstrapEmail.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    const expectedRole = env.superAdminEmail ? 'super_admin' : 'admin';
    if (expectedRole === 'super_admin' && existing.role !== 'super_admin') throw new Error('SUPER_ADMIN_EMAIL already belongs to another account; use a dedicated administrator email and provision it explicitly.');
    existing.role = expectedRole;
    existing.accountType = 'staff';
    existing.accountStatus = 'active';
    existing.emailVerified = true;
    existing.verificationStatus = 'verified';
    existing.isBlocked = false;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    await existing.save();
    console.log(`Bootstrap administrator role synchronized for ${email}`);
    return;
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
