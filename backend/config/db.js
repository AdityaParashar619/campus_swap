import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('bufferCommands', false);

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  if (isDatabaseReady()) return mongoose.connection;

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.databaseConnectTimeoutMs,
    connectTimeoutMS: env.databaseConnectTimeoutMs
  });

  if (isDatabaseReady()) {
    console.log('MongoDB connected');
  }

  return mongoose.connection;
};
