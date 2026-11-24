import mongoose from 'mongoose';
import { isNewDeploymentDatabase, prepareFreshDeploymentIndexes, verifyDeploymentIndexes } from '../config/deploymentIndexes.js';

const [mode, target, ...extra] = process.argv.slice(2);
if (!['--verify', '--apply'].includes(mode) || !isNewDeploymentDatabase(target ?? '') || extra.length || !process.env.MONGO_URI) {
  console.error('Usage: set MONGO_URI and pass --verify or --apply followed by the exact fresh deployment database name.');
  process.exit(1);
}

let client;
try {
  if (new URL(process.env.MONGO_URI).pathname !== `/${target}`) throw new Error('Incorrect target');
  client = new mongoose.mongo.MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const database = client.db();
  if (database.databaseName !== target) throw new Error('Incorrect effective target');
  if (mode === '--apply') {
    const count = await prepareFreshDeploymentIndexes(database);
    console.log(`Required indexes verified. Created: ${count}.`);
  } else {
    await verifyDeploymentIndexes(database);
    console.log('Required indexes verified.');
  }
} catch (error) {
  const message = error.message || '';
  const safeDiagnostic = /^(?:Conflicting index|Missing required deployment indexes|Refusing index changes)/.test(message)
    ? message : error.code === 11000 ? 'Unique index build rejected duplicate keys.' : 'Check the explicit database target, connectivity and migration permissions.';
  console.error(`Index provisioning failed. ${safeDiagnostic}`);
  process.exitCode = 1;
} finally {
  await client?.close();
}
