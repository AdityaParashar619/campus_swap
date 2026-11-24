import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { isDemoDatabase, verifyDeploymentIndexes } from '../config/deploymentIndexes.js';
import User from '../models/User.js';

const [target, ...extra] = process.argv.slice(2);
const email = process.env.DEMO_STUDENT_EMAIL?.toLowerCase();
const password = process.env.DEMO_STUDENT_PASSWORD;
if (target === undefined || !isDemoDatabase(target) || extra.length || !process.env.MONGO_URI ||
    !/^[a-z0-9][a-z0-9._-]{0,63}@demo\.invalid$/.test(email ?? '') ||
    !password || password.length < 16 || Buffer.byteLength(password) > 72) {
  console.error('Specify a demo database and set MONGO_URI, a synthetic @demo.invalid email, and a random 16+ character password.');
  process.exit(1);
}

try {
  if (new URL(process.env.MONGO_URI).pathname !== '/' + target) throw new Error('Invalid target');
  await mongoose.connect(process.env.MONGO_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  if (mongoose.connection.name !== target) throw new Error('Invalid effective target');
  await verifyDeploymentIndexes(mongoose.connection.db);
  await User.create({
    name: 'CampusSwap Demo Student', email, password: await bcrypt.hash(password, 12),
    role: 'student', accountType: 'student', branch: 'cs', department: 'CSE', semester: '7',
    emailVerified: true, verificationStatus: 'verified', accountStatus: 'active', isVerifiedStudent: true
  });
  console.log('Created one synthetic student. Share the credentials privately with the named reviewer.');
} catch (error) {
  console.error(error.code === 11000 ? 'The synthetic account already exists.' : 'Demo provisioning failed. Check target, connectivity, permissions, and required indexes.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
