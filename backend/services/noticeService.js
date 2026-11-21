import { resolveAcademicProgram } from '../utils/academicPrograms.js';

export const buildStudentNoticeFilter = (user, query = {}, now = new Date()) => {
  const program = resolveAcademicProgram(user?.branch);
  const semester = Number(user?.semester);
  const scopes = [{ targetScope: 'college', targetPrograms: { $size: 0 }, targetSemester: null }];
  if (program) {
    scopes.push({ targetScope: 'program', targetPrograms: program.programCode, targetSemester: null });
    if (Number.isInteger(semester) && semester >= 1 && semester <= 8) scopes.push({ targetScope: 'semester', targetPrograms: program.programCode, targetSemester: semester });
  }
  const filter = { status: 'published', publishedAt: { $ne: null, $lte: now }, $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: scopes }] };
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;
  if (query.search) {
    const pattern = new RegExp(query.search, 'i');
    filter.$and.push({ $or: [{ title: pattern }, { content: pattern }] });
  }
  return filter;
};

export const serializeStudentNotice = (notice) => ({
  id: String(notice._id), title: notice.title, content: notice.content, category: notice.category, priority: notice.priority,
  targetScope: notice.targetScope, attachmentUrl: notice.attachmentUrl, attachmentLabel: notice.attachmentLabel,
  sourceUrl: notice.sourceUrl, sourceLabel: notice.sourceLabel, publishedAt: notice.publishedAt, expiresAt: notice.expiresAt,
  attachments: (notice.attachments || []).map((item) => ({
    id: String(item._id), displayName: item.displayName, mimeType: item.mimeType, size: item.size,
    secureUrl: item.secureUrl, kind: item.kind, uploadedAt: item.uploadedAt
  })),
  attribution: 'Published on CampusSwap'
});
