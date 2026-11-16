import mongoose from 'mongoose';
import { env } from './env.js';
import Listing from '../models/Listing.js';

mongoose.set('bufferCommands', false);

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  if (isDatabaseReady()) return mongoose.connection;

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.databaseConnectTimeoutMs,
    connectTimeoutMS: env.databaseConnectTimeoutMs
  });

  // Schema indexes were not being materialized reliably in the deployed container.
  // createIndexes is additive and idempotent; it never drops existing indexes or data.
  await Listing.createIndexes();

  if (isDatabaseReady()) {
    console.log('MongoDB connected');
  }

  return mongoose.connection;
};
