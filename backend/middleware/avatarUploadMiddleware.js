import multer from 'multer';
import { BadRequest } from '../utils/AppError.js';

export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_SIZE_BYTES, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, callback) => callback(acceptedMimeTypes.has(file.mimetype) ? null : new BadRequest('Only JPEG, PNG, and WebP profile images are supported.'), acceptedMimeTypes.has(file.mimetype))
}).single('avatar');

export const avatarUploadMiddleware = (req, res, next) => upload(req, res, (error) => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return next(new BadRequest('Profile image must be 2 MB or smaller.'));
  return next(error instanceof BadRequest ? error : new BadRequest('Invalid profile image upload.'));
});
