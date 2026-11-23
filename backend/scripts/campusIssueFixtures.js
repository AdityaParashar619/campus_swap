import mongoose from 'mongoose';
import { env } from '../config/env.js';
import CampusIssue from '../models/CampusIssue.js';
import User from '../models/User.js';
import { recoverAbandonedIssue, testReportDeletionEnabled } from '../services/campusIssueLifecycle.js';
import { issueId } from '../utils/campusIssueValidation.js';

const [operation, database, id, confirmation, ...extra] = process.argv.slice(2);
try {
  if (extra.length || !database || !['create-test-fixture', 'recover-upload'].includes(operation) || confirmation !== 'CONFIRM') {
    throw new Error('Usage: node scripts/campusIssueFixtures.js <create-test-fixture|recover-upload> <database> <student-or-report-id> CONFIRM');
  }
  issueId(id);
  if (!process.env.MONGO_URI || process.env.MONGO_URI !== env.mongoUri) throw new Error('Set MONGO_URI explicitly.');
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5_000, autoIndex: false, autoCreate: false });
  if (mongoose.connection.name !== database) throw new Error('MongoDB database does not match the requested database.');

  if (operation === 'create-test-fixture') {
    if (!testReportDeletionEnabled()) throw new Error('Test fixtures require the explicitly enabled isolated test database.');
    if (!await User.exists({ _id: id, role: 'student', accountStatus: 'active' })) throw new Error('Provide an active synthetic student ID.');
    const issue = await CampusIssue.create({
      title: 'Synthetic Campus Issues cleanup fixture', category: 'other',
      description: 'Created explicitly by the controlled Campus Issues fixture workflow.',
      createdBy: id, testFixture: true
    });
    console.log(`Created marked test report ${issue.id} in ${database}.`);
  } else {
    if (process.env.CAMPUS_ISSUE_RECOVERY_DATABASE !== database) throw new Error('Set CAMPUS_ISSUE_RECOVERY_DATABASE to the intended database.');
    await recoverAbandonedIssue(id);
    console.log(`Recovered abandoned evidence journal ${id} in ${database}.`);
  }
} catch (error) {
  console.error(error.status || (error.name === 'Error' && !error.code) ? error.message : 'Operation failed. Check the isolated database settings and retry.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
