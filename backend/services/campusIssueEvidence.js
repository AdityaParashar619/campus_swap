import { randomBytes } from 'node:crypto';
import { Transform } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { BadRequest, ServiceUnavailable } from '../utils/AppError.js';

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_MAX_FILES = 3;
const maxPixels = 20_000_000;
const namespace = 'campusswap/campus-issues/evidence';
const formats = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const cloudinaryType = { type: 'authenticated', resource_type: 'image' };

export function evidenceUnavailable(message = 'Private evidence is temporarily unavailable.') {
  const error = new ServiceUnavailable(message);
  error.expose = true;
  return error;
}

function credentials() {
  if (process.env.CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED !== 'true' ||
      !/^[a-z\d_-]+$/i.test(env.cloudinaryCloudName) || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw evidenceUnavailable('Private evidence storage has not been enabled.');
  }
  return {
    cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret, upload_prefix: 'https://api.cloudinary.com'
  };
}

export function checkEvidenceStorage() {
  return credentials().cloud_name;
}

export function isEvidenceMetadata(photo) {
  return photo?.evidenceId && mongoose.isObjectIdOrHexString(photo.evidenceId) &&
    mongoose.isObjectIdOrHexString(photo.storageKey) &&
    Object.hasOwn(formats, photo.mediaType) && Number.isInteger(photo.sizeBytes) &&
    photo.sizeBytes > 0 && photo.sizeBytes <= EVIDENCE_MAX_BYTES;
}

function publicId(issueId, photo) {
  if (!mongoose.isObjectIdOrHexString(issueId) || !isEvidenceMetadata(photo)) throw evidenceUnavailable();
  return `${namespace}/${issueId}/${photo.storageKey}`;
}

export async function sanitizeIssuePhotos(files) {
  if (!files.length || files.length > EVIDENCE_MAX_FILES) throw new BadRequest('Select one to three photos.');
  const photos = [];
  for (const file of files) {
    if (!file.buffer?.length || file.buffer.length > EVIDENCE_MAX_BYTES) throw new BadRequest('Each photo must be 5 MB or smaller.');
    if (!Object.hasOwn(formats, file.mimetype)) throw new BadRequest('Only JPEG, PNG, and WebP photos are supported.');
    let buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: maxPixels, failOn: 'warning' });
      const metadata = await image.metadata();
      if (metadata.format !== (file.mimetype === 'image/jpeg' ? 'jpeg' : formats[file.mimetype])
        || metadata.pages > 1 || metadata.width * metadata.height > maxPixels) {
        throw new Error('Invalid image format or dimensions');
      }
      // Sharp strips metadata by default. Apply EXIF orientation before dropping it.
      buffer = await image.rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequest('Photo content is invalid, does not match its type, or exceeds safe dimensions.');
    }
    if (buffer.length > EVIDENCE_MAX_BYTES) throw new BadRequest('This photo remains too large after processing.');
    photos.push({ buffer, metadata: {
      evidenceId: new mongoose.Types.ObjectId(), storageKey: new mongoose.Types.ObjectId(randomBytes(12)), mediaType: 'image/webp',
      sizeBytes: buffer.length, uploadedAt: new Date()
    } });
  }
  return photos;
}

export async function uploadIssuePhoto(issueId, photo) {
  const id = publicId(issueId, photo.metadata);
  const config = credentials();
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        ...config, ...cloudinaryType, public_id: id, overwrite: false, timeout: 14_000
      }, (error, response) => error ? reject(error) : resolve(response));
      stream.on('error', reject);
      stream.end(photo.buffer);
    });
    if (result?.public_id !== id || result.type !== 'authenticated' ||
        result.resource_type !== 'image' || result.format !== formats[photo.metadata.mediaType]) throw new Error();
  } catch {
    throw evidenceUnavailable('Evidence upload failed. No report was submitted. Please retry.');
  }
}

export async function destroyIssuePhoto(issueId, photo) {
  const id = publicId(issueId, photo);
  try {
    const result = await cloudinary.uploader.destroy(id, {
      ...credentials(), ...cloudinaryType, invalidate: true, timeout: 12_000
    });
    if (!['ok', 'not found'].includes(result?.result)) throw new Error();
  } catch {
    throw evidenceUnavailable('Evidence cleanup is incomplete. Retry this report.');
  }
}

export async function openIssuePhoto(issueId, photo, signal) {
  try {
    const config = credentials();
    const url = new URL(cloudinary.utils.private_download_url(publicId(issueId, photo), formats[photo.mediaType], {
      ...config, ...cloudinaryType, expires_at: Math.floor(Date.now() / 1000) + 60
    }));
    if (url.origin !== 'https://api.cloudinary.com' ||
      url.pathname !== `/v1_1/${config.cloud_name}/image/download` || url.username || url.password) throw new Error();
    const upstream = await fetch(url, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
    const type = upstream.headers.get('content-type')?.split(';')[0];
    if (upstream.status !== 200 || !upstream.body || ![photo.mediaType, 'application/octet-stream'].includes(type)
        || Number(upstream.headers.get('content-length')) > EVIDENCE_MAX_BYTES) {
      await upstream.body?.cancel();
      throw new Error();
    }
    return upstream.body;
  } catch {
    throw evidenceUnavailable('This evidence photo could not be loaded.');
  }
}

export function limitEvidenceStream() {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, done) {
      total += chunk.length;
      if (total > EVIDENCE_MAX_BYTES) return done(new Error('Evidence stream exceeded the maximum length'));
      return done(null, chunk);
    }
  });
}
