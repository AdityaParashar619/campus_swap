import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

process.env.JWT_SECRET ||= 'isolated-product-image-test-secret';
process.env.NODE_ENV = 'test';

const [{ env }, { default: ProductImage }, service] = await Promise.all([
  import('../config/env.js'), import('../models/ProductImage.js'), import('../services/productImageService.js')
]);

const originalConfig = { cloudName: env.cloudinaryCloudName, apiKey: env.cloudinaryApiKey, secret: env.cloudinaryApiSecret };
const configureTestCloudinary = () => {
  env.cloudinaryCloudName = 'test-cloud'; env.cloudinaryApiKey = 'test-key'; env.cloudinaryApiSecret = 'test-secret';
};
const restoreConfig = () => {
  env.cloudinaryCloudName = originalConfig.cloudName; env.cloudinaryApiKey = originalConfig.apiKey; env.cloudinaryApiSecret = originalConfig.secret;
};
const makeImage = async (format, width = 240, height = 240) => {
  const buffer = await sharp({ create: { width, height, channels: 3, background: '#336699' } }).toFormat(format).toBuffer();
  return { buffer, size: buffer.length, mimetype: format === 'jpeg' ? 'image/jpeg' : `image/${format}`, originalname: `item.${format}` };
};

test('decoded JPEG, PNG, and WebP images pass signature and dimension validation', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const metadata = await service.inspectImage(await makeImage(format));
    assert.equal(metadata.format, format);
    assert.equal(metadata.width, 240);
  }
});

test('malformed, unsupported, spoofed, and undersized images are rejected', async () => {
  await assert.rejects(service.inspectImage({ buffer: Buffer.from('not-an-image'), size: 12, mimetype: 'image/jpeg' }), /malformed/);
  const gif = await sharp({ create: { width: 240, height: 240, channels: 3, background: '#fff' } }).gif().toBuffer();
  await assert.rejects(service.inspectImage({ buffer: gif, size: gif.length, mimetype: 'image/gif' }), /Only JPEG/);
  await assert.rejects(service.inspectImage({ ...(await makeImage('png')), mimetype: 'image/jpeg' }), /does not match/);
  await assert.rejects(service.inspectImage(await makeImage('jpeg', 100, 100)), /at least 200/);
});

test('upload rejects oversized files and excessive image counts before provider calls', async () => {
  configureTestCloudinary();
  try {
    const image = await makeImage('jpeg');
    await assert.rejects(service.uploadProductFiles([{ ...image, size: env.productImageMaxSizeBytes + 1 }], '507f1f77bcf86cd799439011'), /MB or smaller/);
    await assert.rejects(service.uploadProductFiles(Array(env.productImageMaxCount + 1).fill(image), '507f1f77bcf86cd799439011'), /maximum/);
  } finally { restoreConfig(); }
});

test('missing Cloudinary configuration fails safely without calling the provider', async () => {
  env.cloudinaryCloudName = ''; env.cloudinaryApiKey = ''; env.cloudinaryApiSecret = '';
  try { await assert.rejects(service.uploadProductFiles([await makeImage('jpeg')], '507f1f77bcf86cd799439011'), (error) => error.status === 503 && !/key|secret/i.test(error.message)); }
  finally { restoreConfig(); }
});

test('valid upload records a pending owner-bound Cloudinary asset', { concurrency: false }, async () => {
  configureTestCloudinary();
  const originalStream = cloudinary.uploader.upload_stream;
  const originalCreate = ProductImage.create;
  let stored;
  cloudinary.uploader.upload_stream = (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(null, { secure_url: 'https://res.cloudinary.com/test/image/upload/item.jpg', public_id: 'campusswap/products/item', asset_id: 'asset-1', bytes: 123 }); done(); } });
  ProductImage.create = async (value) => { stored = value; return { ...value, _id: { toString: () => 'image-1' } }; };
  try {
    const images = await service.uploadProductFiles([await makeImage('jpeg')], '507f1f77bcf86cd799439011');
    assert.equal(images.length, 1);
    assert.equal(stored.status, 'pending');
    assert.equal(stored.owner, '507f1f77bcf86cd799439011');
    assert.match(stored.publicId, /^campusswap\/products\//);
  } finally { cloudinary.uploader.upload_stream = originalStream; ProductImage.create = originalCreate; restoreConfig(); }
});

test('Cloudinary failure becomes a safe service error', { concurrency: false }, async () => {
  configureTestCloudinary();
  const originalStream = cloudinary.uploader.upload_stream;
  cloudinary.uploader.upload_stream = (_options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(new Error('secret provider response')); done(); } });
  try { await assert.rejects(service.uploadProductFiles([await makeImage('png')], '507f1f77bcf86cd799439011'), (error) => error.status === 503 && !error.message.includes('secret provider'));
  } finally { cloudinary.uploader.upload_stream = originalStream; restoreConfig(); }
});

const queryResult = (records) => ({ sort() { return this; }, limit() { return Promise.resolve(records); }, then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); } });

test('image reservation enforces ownership and prevents attachment to another listing', { concurrency: false }, async () => {
  const originalFind = ProductImage.find;
  const owner = { toString: () => 'owner-a' };
  try {
    ProductImage.find = async () => [{ secureUrl: 'https://image', owner: { toString: () => 'owner-b' }, status: 'pending', listing: null }];
    await assert.rejects(service.reserveListingImages({ urls: ['https://image'], ownerId: 'owner-a', listingId: 'listing-a' }), (error) => error.status === 403);
    ProductImage.find = async () => [{ secureUrl: 'https://image', owner, status: 'attached', listing: { toString: () => 'listing-b' } }];
    await assert.rejects(service.reserveListingImages({ urls: ['https://image'], ownerId: 'owner-a', listingId: 'listing-a' }), /another listing/);
  } finally { ProductImage.find = originalFind; }
});

test('legacy URLs remain valid only when already present on the edited listing', { concurrency: false }, async () => {
  const originalFind = ProductImage.find;
  ProductImage.find = async () => [];
  try {
    await service.reserveListingImages({ urls: ['https://legacy.example/item.jpg'], ownerId: 'owner-a', listingId: 'listing-a', existingUrls: ['https://legacy.example/item.jpg'] });
    await assert.rejects(service.reserveListingImages({ urls: ['https://attacker.example/new.jpg'], ownerId: 'owner-a', listingId: 'listing-a', existingUrls: [] }), /not approved/);
  } finally { ProductImage.find = originalFind; }
});

test('expired pending cleanup deletes assets and records retryable failures', { concurrency: false }, async () => {
  configureTestCloudinary();
  const originals = { find: ProductImage.find, deleteOne: ProductImage.deleteOne, updateOne: ProductImage.updateOne, destroy: cloudinary.uploader.destroy };
  let deleted = 0; let retried = 0;
  ProductImage.find = () => queryResult([{ _id: 'ok', publicId: 'ok' }, { _id: 'fail', publicId: 'fail' }]);
  ProductImage.deleteOne = async () => { deleted += 1; };
  ProductImage.updateOne = async (_filter, update) => { if (update.$inc.cleanupAttempts === 1) retried += 1; };
  cloudinary.uploader.destroy = async (publicId) => publicId === 'ok' ? { result: 'ok' } : Promise.reject(new Error('provider down'));
  try {
    const result = await service.cleanupProductImages({ status: 'cleanup_pending' });
    assert.deepEqual(result, { cleaned: 1, failed: 1 }); assert.equal(deleted, 1); assert.equal(retried, 1);
  } finally { ProductImage.find = originals.find; ProductImage.deleteOne = originals.deleteOne; ProductImage.updateOne = originals.updateOne; cloudinary.uploader.destroy = originals.destroy; restoreConfig(); }
});

test('reconciliation marks tracked assets missing from their listing for retryable cleanup', { concurrency: false }, async () => {
  const originals = { find: ProductImage.find, updateMany: ProductImage.updateMany };
  let updatedIds;
  ProductImage.find = () => ({ sort() { return this; }, limit() { return this; }, populate: async () => [
    { _id: 'detached', secureUrl: 'https://removed', listing: { images: ['https://retained'] } },
    { _id: 'retained', secureUrl: 'https://retained', listing: { images: ['https://retained'] } }
  ] });
  ProductImage.updateMany = async (filter) => { updatedIds = filter._id.$in; };
  try {
    assert.equal(await service.reconcileDetachedProductImages(), 1);
    assert.deepEqual(updatedIds, ['detached']);
  } finally { ProductImage.find = originals.find; ProductImage.updateMany = originals.updateMany; }
});
