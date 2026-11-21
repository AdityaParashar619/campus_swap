import mongoose from 'mongoose';
import Notice, { NOTICE_CATEGORIES, NOTICE_PRIORITIES } from '../models/Notice.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, NotFound } from '../utils/AppError.js';
import { buildStudentNoticeFilter, serializeStudentNotice } from '../services/noticeService.js';
import { escapeSearch, parseNoticePagination } from '../utils/noticeValidation.js';

const parseFilters = (query) => {
  const allowed = new Set(['page', 'limit', 'category', 'priority', 'search']);
  const unknown = Object.keys(query).filter((key) => !allowed.has(key));
  if (unknown.length) throw new BadRequest(`Unexpected query fields: ${unknown.join(', ')}`);
  if (query.category && !NOTICE_CATEGORIES.includes(query.category)) throw new BadRequest('Invalid notice category');
  if (query.priority && !NOTICE_PRIORITIES.includes(query.priority)) throw new BadRequest('Invalid notice priority');
  if (query.search != null && (typeof query.search !== 'string' || query.search.trim().length > 100)) throw new BadRequest('search must be at most 100 characters');
  return { category: query.category, priority: query.priority, search: query.search?.trim() ? escapeSearch(query.search.trim()) : '' };
};

const getProfile = async (userId) => {
  const user = await User.findById(userId).select('branch semester');
  if (!user) throw new NotFound('User not found');
  return user;
};

export const listNotices = asyncHandler(async (req, res) => {
  const pagination = parseNoticePagination(req.query);
  const filters = parseFilters(req.query);
  const profile = await getProfile(req.user.userId);
  const filter = buildStudentNoticeFilter(profile, filters);
  const [items, total] = await Promise.all([
    Notice.find(filter).sort({ publishedAt: -1, _id: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Notice.countDocuments(filter)
  ]);
  res.json({ success: true, data: items.map(serializeStudentNotice), pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) } });
});

export const getNotice = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequest('Invalid notice ID');
  const profile = await getProfile(req.user.userId);
  const notice = await Notice.findOne({ _id: req.params.id, ...buildStudentNoticeFilter(profile) }).lean();
  if (!notice) throw new NotFound('Notice not found');
  res.json({ success: true, data: serializeStudentNotice(notice) });
});
