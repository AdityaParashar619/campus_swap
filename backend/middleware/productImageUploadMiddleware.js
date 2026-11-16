import multer from 'multer';
import { env } from '../config/env.js';
import { BadRequest } from '../utils/AppError.js';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.productImageMaxSizeBytes, files: env.productImageMaxCount, fields: 0, parts: env.productImageMaxCount },
  fileFilter: (_req, file, callback) => callback(acceptedMimeTypes.has(file.mimetype) ? null : new BadRequest('Only JPEG, PNG, and WebP images are supported.'), acceptedMimeTypes.has(file.mimetype))
}).array('images', env.productImageMaxCount);

export const productImageUploadMiddleware = (req, res, next) => upload(req, res, (error) => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return next(new BadRequest(`Each image must be ${env.productImageMaxSizeBytes / 1024 / 1024} MB or smaller.`));
  if (['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) return next(new BadRequest(`A maximum of ${env.productImageMaxCount} images is allowed.`));
  return next(error instanceof BadRequest ? error : new BadRequest('Invalid image upload request.'));
});
