import multer from 'multer';
import { BadRequest } from '../utils/AppError.js';

export const NOTICE_ATTACHMENT_MAX_COUNT = 5;
export const NOTICE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const acceptedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: NOTICE_ATTACHMENT_MAX_COUNT, fileSize: NOTICE_ATTACHMENT_MAX_BYTES },
  fileFilter: (_req, file, callback) => {
    const accepted = acceptedMimeTypes.has(String(file.mimetype || '').toLowerCase());
    callback(accepted ? null : new BadRequest('Only PDF, DOCX, JPEG, PNG, and WebP attachments are supported.'), accepted);
  }
});

export const noticeAttachmentUploadMiddleware = upload.array('attachments', NOTICE_ATTACHMENT_MAX_COUNT);
