import { BadRequest } from './AppError.js';
import { getAcademicProgram } from './academicPrograms.js';
import { NOTICE_CATEGORIES, NOTICE_PRIORITIES, NOTICE_TARGET_SCOPES } from '../models/Notice.js';

const EDITABLE = new Set(['title', 'content', 'category', 'priority', 'targetScope', 'targetPrograms', 'targetSemester', 'attachmentUrl', 'attachmentLabel', 'sourceUrl', 'sourceLabel', 'expiresAt']);
const textLimits = { title: 160, content: 10000, attachmentLabel: 100, sourceLabel: 100, attachmentUrl: 2048, sourceUrl: 2048 };
const safeHttps = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

export const normalizeNoticeInput = (body, { partial = false } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('A JSON object is required');
  const keys = Object.keys(body);
  const unknown = keys.filter((key) => !EDITABLE.has(key));
  if (unknown.length) throw new BadRequest(`Unexpected fields: ${unknown.join(', ')}`);
  if (partial && !keys.length) throw new BadRequest('At least one editable field is required');
  const data = {};
  for (const [field, max] of Object.entries(textLimits)) {
    if (!Object.hasOwn(body, field)) continue;
    if (body[field] == null && ['attachmentUrl', 'sourceUrl'].includes(field)) { data[field] = null; continue; }
    if (typeof body[field] !== 'string') throw new BadRequest(`${field} must be text`);
    data[field] = body[field].trim();
    if (data[field].length > max) throw new BadRequest(`${field} must be at most ${max} characters`);
  }
  if (!partial && (!data.title || !data.content)) throw new BadRequest('title and content are required');
  if (Object.hasOwn(body, 'category')) {
    if (!NOTICE_CATEGORIES.includes(body.category)) throw new BadRequest('Invalid notice category');
    data.category = body.category;
  }
  if (Object.hasOwn(body, 'priority')) {
    if (!NOTICE_PRIORITIES.includes(body.priority)) throw new BadRequest('Invalid notice priority');
    data.priority = body.priority;
  }
  if (Object.hasOwn(body, 'targetScope')) {
    if (!NOTICE_TARGET_SCOPES.includes(body.targetScope)) throw new BadRequest('Invalid target scope');
    data.targetScope = body.targetScope;
  }
  if (Object.hasOwn(body, 'targetPrograms')) {
    if (!Array.isArray(body.targetPrograms) || body.targetPrograms.length > 10) throw new BadRequest('targetPrograms must be an array of at most 10 canonical programs');
    data.targetPrograms = [...new Set(body.targetPrograms.map((value) => {
      if (typeof value !== 'string') throw new BadRequest('targetPrograms must contain canonical program codes');
      const program = getAcademicProgram(value);
      if (!program) throw new BadRequest(`Unknown canonical program: ${value}`);
      return program.programCode;
    }))];
  }
  if (Object.hasOwn(body, 'targetSemester')) {
    if (body.targetSemester == null || body.targetSemester === '') data.targetSemester = null;
    else if (!Number.isInteger(body.targetSemester) || body.targetSemester < 1 || body.targetSemester > 8) throw new BadRequest('targetSemester must be an integer from 1 through 8');
    else data.targetSemester = body.targetSemester;
  }
  for (const field of ['attachmentUrl', 'sourceUrl']) if (data[field] && !safeHttps(data[field])) throw new BadRequest(`${field} must be a safe HTTPS URL`);
  if (Object.hasOwn(body, 'expiresAt')) {
    if (body.expiresAt == null || body.expiresAt === '') data.expiresAt = null;
    else { const value = new Date(body.expiresAt); if (Number.isNaN(value.getTime())) throw new BadRequest('expiresAt must be a valid date'); data.expiresAt = value; }
  }
  return data;
};

export const assertNoticePublishable = (notice, now = new Date()) => {
  if (!notice.title?.trim() || !notice.content?.trim()) throw new BadRequest('A title and content are required before publication');
  if (notice.expiresAt && notice.expiresAt <= now) throw new BadRequest('A notice cannot be published after its expiration date');
  if (notice.targetScope === 'college' && ((notice.targetPrograms || []).length || notice.targetSemester != null)) throw new BadRequest('Invalid college targeting');
  if (notice.targetScope === 'program' && (!(notice.targetPrograms || []).length || notice.targetSemester != null)) throw new BadRequest('Program targeting requires programs only');
  if (notice.targetScope === 'semester' && (!(notice.targetPrograms || []).length || !Number.isInteger(notice.targetSemester))) throw new BadRequest('Semester targeting requires programs and semester');
};

export const parseNoticePagination = (query = {}) => {
  const page = query.page == null ? 1 : Number(query.page);
  const limit = query.limit == null ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new BadRequest('page must be an integer from 1 through 10000');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequest('limit must be an integer from 1 through 50');
  return { page, limit, skip: (page - 1) * limit };
};

export const escapeSearch = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
