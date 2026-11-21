import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';

process.env.JWT_SECRET ||= 'isolated-notice-attachment-test-secret';
process.env.NODE_ENV = 'test';

const [{ env }, { default: Notice }, service] = await Promise.all([
  import('../config/env.js'), import('../models/Notice.js'), import('../services/noticeAttachmentService.js')
]);

const originalConfig = { cloud: env.cloudinaryCloudName, key: env.cloudinaryApiKey, secret: env.cloudinaryApiSecret };
const enableCloudinary = () => { env.cloudinaryCloudName = 'test-cloud'; env.cloudinaryApiKey = 'test-key'; env.cloudinaryApiSecret = 'test-secret'; };
const restore = () => { env.cloudinaryCloudName = originalConfig.cloud; env.cloudinaryApiKey = originalConfig.key; env.cloudinaryApiSecret = originalConfig.secret; };
const file = (buffer, mimetype, originalname) => ({ buffer, size: buffer.length, mimetype, originalname });

test('signature inspection accepts decoded images, PDF, and DOCX and rejects spoofed files', async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();
  assert.equal((await service.inspectNoticeAttachment(file(png, 'image/png', 'poster.png'))).kind, 'image');
  assert.equal((await service.inspectNoticeAttachment(file(Buffer.from('%PDF-1.7\nfixture'), 'application/pdf', 'notice.pdf'))).kind, 'pdf');
  const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml')]);
  assert.equal((await service.inspectNoticeAttachment(file(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'notice.docx'))).kind, 'docx');
  await assert.rejects(service.inspectNoticeAttachment(file(Buffer.from('not a pdf'), 'application/pdf', 'fake.pdf')), /signature/i);
  await assert.rejects(service.inspectNoticeAttachment(file(Buffer.from('<svg/>'), 'image/png', 'fake.png')), /malformed/i);
  await assert.rejects(service.inspectNoticeAttachment({ ...file(Buffer.from('%PDF-1.7'), 'application/pdf', 'large.pdf'), size: 10 * 1024 * 1024 + 1 }), /10 MB/i);
});

test('notice schema limits attachments and validates provider-owned metadata', async () => {
  const metadata = (index) => ({ originalName: `file-${index}.pdf`, displayName: `file-${index}.pdf`, mimeType: 'application/pdf', size: 20, publicId: `campusswap/notices/file-${index}`, resourceType: 'raw', secureUrl: `https://res.cloudinary.com/test/raw/upload/file-${index}.pdf`, kind: 'pdf' });
  const notice = new Notice({ title: 'Files', content: 'Files', createdBy: '507f1f77bcf86cd799439011', updatedBy: '507f1f77bcf86cd799439011', attachments: Array.from({ length: 6 }, (_, index) => metadata(index)) });
  await assert.rejects(notice.validate(), /at most 5/i);
  notice.attachments = [metadata(1)]; notice.attachments[0].publicId = 'campusswap/products/wrong';
  await assert.rejects(notice.validate(), /publicId/i);
});

test('upload persists server-generated metadata and rejects a sixth attachment', { concurrency: false }, async () => {
  enableCloudinary();
  const originalStream = cloudinary.uploader.upload_stream;
  cloudinary.uploader.upload_stream = (options, callback) => new Writable({ write(_chunk, _encoding, done) { done(); }, final(done) { callback(null, { secure_url: 'https://res.cloudinary.com/test/raw/upload/notice.pdf', public_id: `${options.folder}/${options.public_id}`, bytes: 22 }); done(); } });
  const notice = { _id: '507f1f77bcf86cd799439011', attachments: [], saveCalls: 0, async save() { this.saveCalls += 1; } };
  try {
    const uploaded = await service.uploadNoticeAttachments({ notice, files: [file(Buffer.from('%PDF-1.7\nfixture'), 'application/pdf', '../notice.pdf')] });
    assert.equal(uploaded.length, 1); assert.equal(notice.saveCalls, 1); assert.equal(notice.attachments[0].displayName, '.._notice.pdf');
    notice.attachments = Array.from({ length: 5 }, () => uploaded[0]);
    await assert.rejects(service.uploadNoticeAttachments({ notice, files: [file(Buffer.from('%PDF-1.7'), 'application/pdf', 'six.pdf')] }), /at most 5/i);
  } finally { cloudinary.uploader.upload_stream = originalStream; restore(); }
});
