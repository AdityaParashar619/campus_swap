import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Tips:');
    console.error('1) Start MongoDB service locally, then retry.');
    console.error('2) If local MongoDB is not installed, install MongoDB Community Server.');
    console.error('3) Or set MONGO_URI in backend/.env to your MongoDB Atlas URI.');
    console.error(`Current MONGO_URI: ${env.mongoUri}`);
    process.exit(1);
  }
};
