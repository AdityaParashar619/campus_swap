import mongoose from 'mongoose';
import Notice, { NOTICE_CATEGORIES, NOTICE_STATUSES } from '../models/Notice.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, NotFound } from '../utils/AppError.js';
import { assertNoticePublishable, escapeSearch, normalizeNoticeInput, parseNoticePagination } from '../utils/noticeValidation.js';
import { academicPrograms } from '../utils/academicPrograms.js';
import { removeNoticeAttachment, uploadNoticeAttachments } from '../services/noticeAttachmentService.js';

const requireId = (id) => { if (!mongoose.isValidObjectId(id)) throw new BadRequest('Invalid notice ID'); };
const findNotice = async (id) => { requireId(id); const notice = await Notice.findById(id); if (!notice) throw new NotFound('Notice not found'); return notice; };

export const createNotice = asyncHandler(async (req, res) => {
  const data = normalizeNoticeInput(req.body);
  const notice = await Notice.create({ ...data, status: 'draft', createdBy: req.user.userId, updatedBy: req.user.userId });
  res.status(201).json({ success: true, data: notice });
});

export const listAdminNotices = asyncHandler(async (req, res) => {
  const allowed = new Set(['page', 'limit', 'status', 'category', 'search']);
  const unknown = Object.keys(req.query).filter((key) => !allowed.has(key));
  if (unknown.length) throw new BadRequest(`Unexpected query fields: ${unknown.join(', ')}`);
  const { page, limit, skip } = parseNoticePagination(req.query);
  const filter = {};
  if (req.query.status) { if (!NOTICE_STATUSES.includes(req.query.status)) throw new BadRequest('Invalid notice status'); filter.status = req.query.status; }
  if (req.query.category) { if (!NOTICE_CATEGORIES.includes(req.query.category)) throw new BadRequest('Invalid notice category'); filter.category = req.query.category; }
  if (req.query.search != null) {
    if (typeof req.query.search !== 'string' || req.query.search.trim().length > 100) throw new BadRequest('search must be at most 100 characters');
    if (req.query.search.trim()) { const pattern = new RegExp(escapeSearch(req.query.search.trim()), 'i'); filter.$or = [{ title: pattern }, { content: pattern }]; }
  }
  const [data, total] = await Promise.all([Notice.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit), Notice.countDocuments(filter)]);
  res.json({ success: true, data, programs: academicPrograms, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const getAdminNotice = asyncHandler(async (req, res) => res.json({ success: true, data: await findNotice(req.params.id) }));

export const updateNotice = asyncHandler(async (req, res) => {
  const notice = await findNotice(req.params.id);
  const data = normalizeNoticeInput(req.body, { partial: true });
  Object.assign(notice, data, { updatedBy: req.user.userId });
  if (notice.status === 'published') assertNoticePublishable(notice);
  await notice.save();
  res.json({ success: true, data: notice });
});

export const publishNotice = asyncHandler(async (req, res) => {
  if (req.body && Object.keys(req.body).length) throw new BadRequest('Publish does not accept a request body');
  const notice = await findNotice(req.params.id);
  assertNoticePublishable(notice);
  const firstPublication = notice.status !== 'published';
  notice.status = 'published';
  if (firstPublication) notice.publishedAt = new Date();
  notice.archivedAt = null;
  notice.updatedBy = req.user.userId;
  await notice.save();
  res.json({ success: true, data: notice });
});

export const archiveNotice = asyncHandler(async (req, res) => {
  if (req.body && Object.keys(req.body).length) throw new BadRequest('Archive does not accept a request body');
  const notice = await findNotice(req.params.id);
  if (notice.status !== 'published') throw new BadRequest('Only a published notice can be archived');
  notice.status = 'archived';
  notice.archivedAt = new Date();
  notice.updatedBy = req.user.userId;
  await notice.save();
  res.json({ success: true, data: notice });
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  const notice = await findNotice(req.params.id);
  const uploaded = await uploadNoticeAttachments({ notice, files: req.files });
  res.status(201).json({ success: true, data: notice, uploaded });
});

export const removeAttachment = asyncHandler(async (req, res) => {
  const notice = await findNotice(req.params.id);
  const result = await removeNoticeAttachment({ notice, attachmentId: req.params.attachmentId });
  res.json({ success: true, data: notice, cleanup: result.providerDeletion });
});
