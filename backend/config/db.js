import mongoose from 'mongoose';
import { env } from './env.js';
import { isDemoDatabase, verifyDeploymentIndexes } from './deploymentIndexes.js';
import Listing from '../models/Listing.js';
import CampusIssue from '../models/CampusIssue.js';
import { ServiceUnavailable } from '../utils/AppError.js';

mongoose.set('bufferCommands', false);

let verifiedDatabase;
const requireVerifiedIndexes = env.nodeEnv === 'production';

mongoose.connection.on('disconnected', () => { verifiedDatabase = undefined; });

export const isDatabaseReady = () => mongoose.connection.readyState === 1 &&
  (!requireVerifiedIndexes || Boolean(verifiedDatabase && verifiedDatabase === mongoose.connection.db));

const campusIssueIndexesByDatabase = new WeakMap();

export function ensureCampusIssueIndexes() {
  const connection = CampusIssue.db;
  const database = connection.db;
  if (connection.readyState !== 1 || !database) {
    throw new ServiceUnavailable('Database is temporarily unavailable. Please retry shortly.');
  }

  if (requireVerifiedIndexes) {
    if (!isDatabaseReady()) throw new ServiceUnavailable('Database is temporarily unavailable. Please retry shortly.');
    return Promise.resolve();
  }

  let indexes = campusIssueIndexesByDatabase.get(database);
  if (!indexes) {
    // Keep one additive build per driver database, and allow a retry after a failure.
    indexes = CampusIssue.createIndexes().catch((error) => {
      campusIssueIndexesByDatabase.delete(database);
      throw error;
    });
    campusIssueIndexesByDatabase.set(database, indexes);
  }
  return indexes;
}

export const connectDB = async () => {
  if (isDatabaseReady()) return mongoose.connection;

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: env.databaseConnectTimeoutMs,
      connectTimeoutMS: env.databaseConnectTimeoutMs,
      ...(requireVerifiedIndexes ? { autoCreate: false, autoIndex: false, maxPoolSize: 10 } : {})
    });
  }

  if (requireVerifiedIndexes) {
    const database = mongoose.connection.db;
    if (!database || (env.demoMode && !isDemoDatabase(database.databaseName))) {
      throw new Error('Database target validation failed');
    }
    await verifyDeploymentIndexes(database);
    if (env.demoMode && await database.collection('users').findOne(
      { email: { $not: /@demo\.invalid$/ } }, { projection: { _id: 1 } }
    )) {
      throw new Error('Demo database contains a non-synthetic identity');
    }
    if (mongoose.connection.readyState !== 1 || mongoose.connection.db !== database) {
      throw new Error('Database disconnected during index verification');
    }
    verifiedDatabase = database;
    return mongoose.connection;
  }

  // Schema indexes were not being materialized reliably in the deployed container.
  // createIndexes is additive and idempotent; it never drops existing indexes or data.
  await Promise.all([Listing.createIndexes(), ensureCampusIssueIndexes()]);

  if (isDatabaseReady()) {
    console.log('MongoDB connected');
  }

  return mongoose.connection;
};
