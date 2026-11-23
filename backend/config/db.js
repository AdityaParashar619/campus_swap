import mongoose from 'mongoose';
import { env } from './env.js';
import Listing from '../models/Listing.js';
import CampusIssue from '../models/CampusIssue.js';
import { ServiceUnavailable } from '../utils/AppError.js';

mongoose.set('bufferCommands', false);

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

const campusIssueIndexesByDatabase = new WeakMap();

export function ensureCampusIssueIndexes() {
  const connection = CampusIssue.db;
  const database = connection.db;
  if (connection.readyState !== 1 || !database) {
    throw new ServiceUnavailable('Database is temporarily unavailable. Please retry shortly.');
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

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.databaseConnectTimeoutMs,
    connectTimeoutMS: env.databaseConnectTimeoutMs
  });

  // Schema indexes were not being materialized reliably in the deployed container.
  // createIndexes is additive and idempotent; it never drops existing indexes or data.
  await Promise.all([Listing.createIndexes(), ensureCampusIssueIndexes()]);

  if (isDatabaseReady()) {
    console.log('MongoDB connected');
  }

  return mongoose.connection;
};
