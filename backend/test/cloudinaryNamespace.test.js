import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'cloudinary-namespace-test-secret';
process.env.CLOUDINARY_ASSET_NAMESPACE = 'campusswap-faculty';
const { env } = await import('../config/env.js');
const { uploadAvatar } = await import('../services/avatarService.js');
const { uploadProductFiles, cleanupProductImages, deleteOwnedPendingImage } = await import('../services/productImageService.js');
const { uploadNoticeAttachments, removeNoticeAttachment } = await import('../services/noticeAttachmentService.js');
const { default: ProductImage } = await import('../models/ProductImage.js');
const { default: Notice } = await import('../models/Notice.js');
const { makeScopedAssetId } = await import('../utils/cloudinaryNamespace.js');

Object.assign(env, { cloudinaryCloudName: 'test', cloudinaryApiKey: 'fixture', cloudinaryApiSecret: 'fixture' });
const owner = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const buf = await sharp({ create: { width: 220, height: 220, channels: 3, background: 'green' } }).jpeg().toBuffer();
const jpeg = { buffer: buf, size: buf.length, mimetype: 'image/jpeg', originalname: 'fixture.jpg' };
const pdfBuffer = Buffer.from('%PDF-1.4');
const pdf = { buffer: pdfBuffer, size: pdfBuffer.length, mimetype: 'application/pdf', originalname: 'fixture.pdf' };
const notice = () => new Notice({ _id: owner, title: 'Fixture', content: 'Fixture', createdBy: owner, updatedBy: owner });

test('faculty uploads use scoped unique IDs and never overwrite', async (t) => {
  const opts = [];
  t.mock.method(ProductImage, 'create', async (data) => data);
  t.mock.method(Notice.prototype, 'save', async function () { return this.validate(); });
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      opts.push(options);
      callback(null, { public_id: options.public_id, secure_url: 'https://res.cloudinary.com/test/fixture' });
      done();
    }
  }));
  await uploadAvatar(jpeg, owner);
  await uploadAvatar(jpeg, owner);
  await uploadProductFiles([jpeg], owner);
  await uploadNoticeAttachments({ notice: notice(), files: [jpeg, pdf] });
  assert.deepEqual(opts.map(o => o.public_id.split('/')[1]), ['avatars', 'avatars', 'products', 'notices', 'notices']);
  assert.equal(new Set(opts.map(o => o.public_id)).size, 5);
  for (const o of opts) {
    assert.ok(o.public_id.startsWith('campusswap-faculty/'));
    assert.equal(o.overwrite, false);
    assert.equal(o.folder, undefined);
  }
  assert.ok(opts[4].public_id.endsWith('.pdf'));
});

test('an existing Cloudinary asset is refused and never adopted or deleted', async (t) => {
  const writes = t.mock.method(ProductImage, 'create', async () => { throw new Error('unexpected write'); });
  const deletes = t.mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('unexpected delete'); });
  t.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => new Writable({
    write(_chunk, _encoding, done) { done(); },
    final(done) {
      callback(null, { public_id: options.public_id, existing: true, secure_url: 'https://res.cloudinary.com/test/fixture' });
      done();
    }
  }));
  await assert.rejects(uploadAvatar(jpeg, owner), { status: 503 });
  await assert.rejects(uploadProductFiles([jpeg], owner), { status: 503 });
  await assert.rejects(uploadNoticeAttachments({ notice: notice(), files: [jpeg] }), { status: 503 });
  assert.equal(writes.mock.callCount(), 0);
  assert.equal(deletes.mock.callCount(), 0);
});

test('product cleanup and notice removal reject development assets and mismatched owners', async (t) => {
  const allowed = makeScopedAssetId('products', owner);
  const wrongOwner = makeScopedAssetId('products', other);
  const records = [allowed.replace('campusswap-faculty/', 'campusswap/'), wrongOwner, allowed]
    .map((publicId, index) => ({ _id: index, publicId, owner, async save() { throw new Error('unexpected write'); } }));
  const destroys = t.mock.method(cloudinary.uploader, 'destroy', async () => ({ result: 'ok' }));
  t.mock.method(ProductImage, 'findOne', async () => records[0]);
  t.mock.method(ProductImage, 'find', () => ({ sort: () => ({ limit: async () => records }) }));
  t.mock.method(ProductImage, 'deleteOne', async () => {});
  await assert.rejects(deleteOwnedPendingImage(other, owner), { status: 403 });
  assert.deepEqual(await cleanupProductImages({}), { cleaned: 1, failed: 2 });
  for (const publicId of [
    makeScopedAssetId('notices', owner).replace('campusswap-faculty/', 'campusswap/'),
    makeScopedAssetId('notices', other)
  ]) {
    await assert.rejects(removeNoticeAttachment({
      notice: { _id: owner, attachments: { id: () => ({ toObject: () => ({ publicId, resourceType: 'image', kind: 'image' }) }) } },
      attachmentId: other
    }), { status: 400 });
  }
  assert.deepEqual(destroys.mock.calls.map(call => call.arguments[0]), [allowed]);
});
