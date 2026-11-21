import { BadRequest } from './AppError.js';

const text = (value, field, { required = false, max = 500 } = {}) => {
  if (value == null) value = '';
  if (typeof value !== 'string') throw new BadRequest(`${field} must be a string`);
  const normalized = value.trim();
  if (required && !normalized) throw new BadRequest(`${field} is required`);
  if (normalized.length > max) throw new BadRequest(`${field} must be at most ${max} characters`);
  return normalized;
};

export const isSafeNoteFileUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
};

export const normalizeNoteInput = (body = {}) => {
  const fileUrl = text(body.fileUrl, 'fileUrl', { required: true, max: 2048 });
  if (!isSafeNoteFileUrl(fileUrl)) throw new BadRequest('fileUrl must be a valid HTTPS URL');

  const semester = text(body.semester, 'semester', { required: true, max: 2 });
  if (!/^[1-8]$/.test(semester)) throw new BadRequest('semester must be between 1 and 8');

  const fileType = body.fileType == null ? 'other' : text(body.fileType, 'fileType', { max: 10 }).toLowerCase();
  if (!['pdf', 'image', 'doc', 'other'].includes(fileType)) throw new BadRequest('fileType is invalid');

  if (body.tags != null && !Array.isArray(body.tags)) throw new BadRequest('tags must be an array');
  const tags = (body.tags || []).slice(0, 10).map((tag) => text(tag, 'tag', { max: 40 })).filter(Boolean);

  return {
    title: text(body.title, 'title', { required: true, max: 160 }),
    description: text(body.description, 'description', { max: 2000 }),
    fileUrl,
    fileType,
    branch: text(body.branch, 'branch', { required: true, max: 40 }),
    semester,
    subject: text(body.subject, 'subject', { required: true, max: 120 }),
    tags
  };
};
