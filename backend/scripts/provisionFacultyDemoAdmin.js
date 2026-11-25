import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { isPasswordStrong } from '../utils/passwordPolicy.js';
import { createAdministrator } from './ensureAdmin.js';

const [target, ...extra] = process.argv.slice(2);
if (!env.facultyDemoMode || env.adminBootstrapEnabled || target !== 'campusswap_demo' || extra.length) {
  console.error('Expected the reviewed faculty demo configuration and the explicit campusswap_demo target.');
  process.exit(1);
}

try {
  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!isPasswordStrong(password) || Buffer.byteLength(password) > 72) {
    throw new Error('Invalid administrator password');
  }
  const connection = await connectDB();
  if (connection.name !== target ||
      await User.exists({ $or: [{ email: env.adminEmail }, { role: { $ne: 'student' } }] })) {
    throw new Error('Unsafe target or existing administrator');
  }
  await createAdministrator({
    name: env.adminName,
    email: env.adminEmail,
    password,
    role: 'admin',
    // The existing unique enrollment index makes concurrent provisioning fail closed.
    enrollmentNumber: 'ADMIN-FACULTY-DEMO'
  });
  console.log('Created one faculty demo administrator.');
} catch {
  console.error('Administrator provisioning refused or failed. Check the target, password policy, indexes and existing accounts.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
