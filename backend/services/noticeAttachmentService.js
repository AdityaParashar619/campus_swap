import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import Notice from '../models/Notice.js';
import { env } from '../config/env.js';
import { BadRequest, ServiceUnavailable } from '../utils/AppError.js';
import { NOTICE_ATTACHMENT_MAX_BYTES, NOTICE_ATTACHMENT_MAX_COUNT } from '../middleware/noticeAttachmentUploadMiddleware.js';
import { assetFolder, makeScopedAssetId, matchesScopedUpload, ownsScopedAsset, usesScopedAssets } from '../utils/cloudinaryNamespace.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const configured = () => Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
const configure = () => {
  if (!configured()) throw new ServiceUnavailable('Notice attachment uploads are not configured.');
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
};
const safeName = (value) => String(value || 'attachment').replace(/[\\/\0-\x1f\x7f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'attachment';
const startsWith = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);
const attachmentExtension = (kind) => kind === 'pdf' ? '.pdf' : kind === 'docx' ? '.docx' : '';

export const inspectNoticeAttachment = async (file) => {
  if (!file?.buffer?.length || !Number.isFinite(file.size) || file.size < 1) throw new BadRequest('Attachment is empty.');
  if (file.size > NOTICE_ATTACHMENT_MAX_BYTES) throw new BadRequest('Each attachment must be 10 MB or smaller.');
  const mimeType = String(file.mimetype || '').toLowerCase();
  if (imageMimes.has(mimeType)) {
    let metadata;
    try { metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'error' }).metadata(); }
    catch { throw new BadRequest('Image attachment is malformed or unsafe.'); }
    const format = metadata.format === 'jpg' ? 'jpeg' : metadata.format;
    const expected = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    if (expected !== mimeType || !['jpeg', 'png', 'webp'].includes(format)) throw new BadRequest('Image type does not match its content.');
    return { mimeType, resourceType: 'image', kind: 'image' };
  }
  if (mimeType === 'application/pdf') {
    if (!startsWith(file.buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) throw new BadRequest('PDF signature is invalid.');
    return { mimeType, resourceType: 'raw', kind: 'pdf' };
  }
  if (mimeType === DOCX_MIME) {
    const zip = startsWith(file.buffer, [0x50, 0x4b, 0x03, 0x04]);
    const content = file.buffer.toString('latin1');
    if (!zip || !content.includes('[Content_Types].xml') || !content.includes('word/')) throw new BadRequest('DOCX signature is invalid.');
    return { mimeType, resourceType: 'raw', kind: 'docx' };
  }
  throw new BadRequest('Unsupported attachment type.');
};

const uploadBuffer = (file, resourceType, publicId) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ resource_type: resourceType, ...(!usesScopedAssets() && { folder: assetFolder('notices') }), public_id: publicId, overwrite: false, type: 'upload', timeout: 45_000 },
    (error, result) => error ? reject(error) : resolve(result));
  stream.end(file.buffer);
});

export const uploadNoticeAttachments = async ({ notice, files }) => {
  if (!Array.isArray(files) || files.length === 0) throw new BadRequest('Select at least one attachment.');
  if ((notice.attachments?.length || 0) + files.length > NOTICE_ATTACHMENT_MAX_COUNT) throw new BadRequest(`A notice can contain at most ${NOTICE_ATTACHMENT_MAX_COUNT} attachments.`);
  configure();
  const uploaded = [];
  for (const file of files) {
    const inspected = await inspectNoticeAttachment(file);
    let result;
    const extension = attachmentExtension(inspected.kind);
    const publicId = usesScopedAssets() ? makeScopedAssetId('notices', notice._id, extension) : notice._id + '-' + crypto.randomUUID() + extension;
    try { result = await uploadBuffer(file, inspected.resourceType, publicId); }
    catch { throw new ServiceUnavailable('Attachment upload service is temporarily unavailable.'); }
    const approvedId = usesScopedAssets() ? matchesScopedUpload(result, publicId) : result?.public_id?.startsWith(assetFolder('notices') + '/');
    if (!result?.secure_url?.startsWith('https://') || !approvedId) throw new ServiceUnavailable('Attachment service returned an invalid response.');
    const metadata = {
      originalName: safeName(file.originalname), displayName: safeName(file.originalname), mimeType: inspected.mimeType,
      size: Number(result.bytes) || file.size, publicId: result.public_id, resourceType: inspected.resourceType,
      secureUrl: result.secure_url, kind: inspected.kind, uploadedAt: new Date()
    };
    notice.attachments.push(metadata);
    await notice.save();
    uploaded.push(metadata);
  }
  return uploaded;
};

export const removeNoticeAttachment = async ({ notice, attachmentId }) => {
  const attachment = notice.attachments.id(attachmentId);
  if (!attachment) throw new BadRequest('Attachment not found.');
  const metadata = attachment.toObject();
  const extension = attachmentExtension(metadata.kind);
  const approved = usesScopedAssets()
    ? metadata.resourceType === (extension ? 'raw' : 'image') && ownsScopedAsset(metadata.publicId, 'notices', notice._id, extension)
    : metadata.publicId.startsWith(assetFolder('notices') + '/');
  if (!approved) throw new BadRequest('Attachment ownership could not be verified.');
  attachment.deleteOne();
  await notice.save();
  const shared = await Notice.exists({ _id: { $ne: notice._id }, 'attachments.publicId': metadata.publicId });
  if (shared || !configured()) return { attachment: metadata, providerDeletion: shared ? 'shared_reference_preserved' : 'cleanup_required' };
  configure();
  try {
    const result = await cloudinary.uploader.destroy(metadata.publicId, { resource_type: metadata.resourceType, type: 'upload', invalidate: true });
    return { attachment: metadata, providerDeletion: ['ok', 'not found'].includes(result?.result) ? 'deleted' : 'cleanup_required' };
  } catch { return { attachment: metadata, providerDeletion: 'cleanup_required' }; }
};
