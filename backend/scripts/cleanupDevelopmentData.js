import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_DATABASES = new Set(['campusswap']);
const EXECUTION_CONFIRMATION = 'DELETE_DEVELOPMENT_DATA';
const CLOUDINARY_PRODUCT_PREFIX = 'campusswap/products/';
const CLOUDINARY_AVATAR_PREFIX = 'campusswap/avatars/';
const ALLOWED_MONGO_HOSTS = new Set(['mongodb', 'localhost', '127.0.0.1']);

const args = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.replace(/^--/, '').split('=');
    return [key, value.length ? value.join('=') : true];
  }),
);

const fail = (message) => {
  throw new Error(message);
};

const hashFile = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex').toUpperCase();
};

const assertBackup = async () => {
  if (!args.backup || !args['backup-sha256']) {
    fail('Both --backup and --backup-sha256 are required.');
  }
  if (!existsSync(args.backup) || statSync(args.backup).size === 0) {
    fail('The required backup is missing or empty.');
  }
  const actualHash = await hashFile(args.backup);
  if (actualHash !== String(args['backup-sha256']).toUpperCase()) {
    fail('The backup SHA-256 does not match the reviewed backup.');
  }
};

const trustedCloudinaryUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
};

const trustedAvatarPublicId = (user) => {
  if (!user?.profilePicture || !trustedCloudinaryUrl(user.profilePicture)) return null;
  const publicId = `${CLOUDINARY_AVATAR_PREFIX}user-${user._id}`;
  return decodeURIComponent(new URL(user.profilePicture).pathname).includes(`/${publicId}.`)
    ? publicId
    : null;
};

const collectionCounts = async (db, collectionNames) =>
  Object.fromEntries(
    await Promise.all(
      collectionNames.map(async (name) => [name, await db.collection(name).countDocuments()]),
    ),
  );

const main = async () => {
  const executeRequested = args.execute === true;
  if (args.execute !== undefined && !executeRequested) fail('--execute does not accept a value.');
  if (process.env.NODE_ENV !== 'development') fail('NODE_ENV must be exactly development.');
  if (!ALLOWED_DATABASES.has(args.database)) fail('Database is not explicitly allowlisted.');
  if (args.database !== 'campusswap') fail('Unexpected database name.');
  const reviewedAdminId = process.env.CLEANUP_EXPECTED_ADMIN_ID;
  const reviewedAdminEmail = process.env.CLEANUP_EXPECTED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!/^[0-9a-f]{24}$/.test(reviewedAdminId ?? '') ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewedAdminEmail ?? '')) {
    fail('Supply the independently reviewed administrator ID and email in CLEANUP_EXPECTED_ADMIN_ID and CLEANUP_EXPECTED_ADMIN_EMAIL.');
  }
  if (args['admin-id'] !== reviewedAdminId) fail('Administrator ID does not match the reviewed account.');
  if (executeRequested && args.confirm !== EXECUTION_CONFIRMATION) fail('Execution confirmation is missing or incorrect.');

  await assertBackup();

  const mongoUri = process.env.CLEANUP_MONGO_URI || process.env.MONGO_URI;
  if (!mongoUri) fail('CLEANUP_MONGO_URI or MONGO_URI is required.');
  const uri = new URL(mongoUri);
  if (!ALLOWED_MONGO_HOSTS.has(uri.hostname)) fail('MongoDB host is not an allowlisted local development host.');
  const uriDatabase = uri.pathname.replace(/^\//, '').split('?')[0];
  if (uriDatabase !== args.database) fail('MongoDB URI database does not match --database.');
  if (/phase42|test|staging|prod/i.test(uriDatabase)) fail('Refusing a test, staging, or production-like database.');

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (db.databaseName !== args.database) fail('Connected database identity changed unexpectedly.');

  const users = db.collection('users');
  const adminObjectId = new mongoose.Types.ObjectId(reviewedAdminId);
  const admin = await users.findOne({ _id: adminObjectId });
  if (!admin || admin.role !== 'admin' || admin.email !== reviewedAdminEmail) {
    fail('Preserved administrator identity, email, or role does not match the reviewed account.');
  }

  const applicationCollections = [
    'alumniverifications',
    'auditlogs',
    'bounties',
    'connections',
    'emailverifications',
    'enrollmentreservations',
    'listings',
    'messages',
    'notes',
    'notifications',
    'productimages',
    'reports',
    'requestposts',
  ];
  const allCollections = [...applicationCollections, 'refreshsessions', 'users'];
  const before = await collectionCounts(db, allCollections);
  const adminSessions = await db.collection('refreshsessions').countDocuments({ user: adminObjectId });

  const productImages = await db.collection('productimages').find({}).toArray();
  const productAssets = productImages.map((image) => {
    if (
      typeof image.publicId !== 'string' ||
      !image.publicId.startsWith(CLOUDINARY_PRODUCT_PREFIX) ||
      !trustedCloudinaryUrl(image.secureUrl) ||
      !decodeURIComponent(new URL(image.secureUrl).pathname).includes(`/${image.publicId}.`)
    ) {
      fail(`Product image ${image._id} lacks trusted Cloudinary ownership evidence.`);
    }
    return { publicId: image.publicId, recordId: String(image._id) };
  });
  if (new Set(productAssets.map(({ publicId }) => publicId)).size !== productAssets.length) {
    fail('Duplicate ProductImage public IDs require manual review.');
  }

  const nonAdminUsers = await users.find({ _id: { $ne: adminObjectId } }).toArray();
  const avatarAssets = nonAdminUsers
    .map((user) => trustedAvatarPublicId(user))
    .filter(Boolean)
    .map((publicId) => ({ publicId, recordId: null }));

  const expectedAfter = Object.fromEntries(allCollections.map((name) => [name, 0]));
  expectedAfter.users = 1;
  expectedAfter.refreshsessions = adminSessions;

  const plan = {
    mode: executeRequested ? 'EXECUTE' : 'DRY_RUN',
    database: db.databaseName,
    preservedAdmin: { id: String(admin._id), email: admin.email, role: admin.role },
    before,
    expectedAfter,
    cloudinaryAssets: [...productAssets, ...avatarAssets],
  };
  console.log(JSON.stringify(plan, null, 2));

  if (!executeRequested) return;

  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );
  if (plan.cloudinaryAssets.length && !cloudinaryConfigured) {
    fail('Cloudinary credentials are required because reviewed assets are scheduled for deletion.');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const unresolvedAssets = [];
  for (const asset of plan.cloudinaryAssets) {
    try {
      const result = await cloudinary.uploader.destroy(asset.publicId, { invalidate: true, resource_type: 'image' });
      if (!['ok', 'not found'].includes(result.result)) unresolvedAssets.push({ ...asset, result: result.result });
    } catch (error) {
      unresolvedAssets.push({ ...asset, error: error.message });
    }
  }

  for (const name of applicationCollections) await db.collection(name).deleteMany({});
  await db.collection('refreshsessions').deleteMany({ user: { $ne: adminObjectId } });
  await users.deleteMany({ _id: { $ne: adminObjectId } });
  await users.updateOne(
    { _id: adminObjectId },
    { $set: { savedListings: [], bookmarkedNotes: [] } },
  );

  const preserved = await users.findOne({ _id: adminObjectId });
  if (!preserved || preserved.email !== reviewedAdminEmail || preserved.role !== 'admin') {
    fail('Post-cleanup administrator verification failed. Restore the reviewed backup.');
  }
  const after = await collectionCounts(db, allCollections);
  console.log(JSON.stringify({ after, unresolvedCloudinaryAssets: unresolvedAssets }, null, 2));
  if (unresolvedAssets.length) process.exitCode = 2;
};

main()
  .catch((error) => {
    console.error(`Cleanup refused or failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
