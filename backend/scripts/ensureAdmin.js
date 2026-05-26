import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import User from '../models/User.js';

export const ensureAdminUser = async () => {
  if (!env.adminEmail || !env.adminPassword) return;

  const email = env.adminEmail.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      existing.isBlocked = false;
      await existing.save();
      console.log(`Admin role granted to ${email}`);
    }
    return;
  }

  await User.create({
    name: env.adminName,
    email,
    enrollmentNumber: `ADMIN-${Date.now()}`,
    password: await bcrypt.hash(env.adminPassword, 12),
    role: 'admin',
    isVerifiedStudent: true
  });

  console.log(`Admin user created: ${email}`);
};
