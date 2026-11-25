import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const createAdministrator = async ({ name, email, password, role, enrollmentNumber }) => User.create({
  name,
  email,
  enrollmentNumber,
  password: await bcrypt.hash(password, 12),
  role,
  accountType: 'staff',
  accountStatus: 'active',
  emailVerified: true,
  verificationStatus: 'verified',
  isVerifiedStudent: true
});

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

  await createAdministrator({
    name: env.adminName,
    email,
    enrollmentNumber: `ADMIN-${Date.now()}`,
    password: bootstrapPassword,
    role: env.superAdminEmail ? 'super_admin' : 'admin'
  });

  console.log('Administrator bootstrap completed');
};
