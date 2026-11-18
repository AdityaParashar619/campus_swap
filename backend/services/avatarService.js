import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { BadRequest, ServiceUnavailable } from '../utils/AppError.js';
import { AVATAR_MAX_SIZE_BYTES } from '../middleware/avatarUploadMiddleware.js';

const AVATAR_FOLDER = 'campusswap/avatars';
const allowedFormats = new Set(['jpeg', 'png', 'webp']);

const configure = () => {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) throw new ServiceUnavailable('Profile image uploads are not configured.');
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
};

export const validateAvatar = async (file) => {
  if (!file?.buffer?.length || !Number.isFinite(file.size) || file.size > AVATAR_MAX_SIZE_BYTES) throw new BadRequest('Select a profile image up to 2 MB.');
  let metadata;
  try { metadata = await sharp(file.buffer, { limitInputPixels: 16_000_000, failOn: 'error' }).metadata(); }
  catch { throw new BadRequest('Profile image content is malformed or too large.'); }
  const format = metadata.format === 'jpg' ? 'jpeg' : metadata.format;
  if (!allowedFormats.has(format)) throw new BadRequest('Only JPEG, PNG, and WebP profile images are supported.');
  if (!metadata.width || !metadata.height || metadata.width < 128 || metadata.height < 128 || metadata.width > 4000 || metadata.height > 4000) throw new BadRequest('Profile images must be between 128 and 4000 pixels in each dimension.');
  const expectedMime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  if (file.mimetype !== expectedMime) throw new BadRequest('Profile image type does not match its content.');
  return format;
};

export const uploadAvatar = async (file, userId) => {
  await validateAvatar(file);
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'image', folder: AVATAR_FOLDER, public_id: `user-${userId}`, overwrite: true,
      invalidate: true, transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }]
    }, (error, result) => {
      if (error || !result?.secure_url?.startsWith('https://')) return reject(new ServiceUnavailable('Profile image service is temporarily unavailable.'));
      resolve(result.secure_url);
    });
    stream.end(file.buffer);
  });
};
