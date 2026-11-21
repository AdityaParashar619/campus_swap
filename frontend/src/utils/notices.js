export const NOTICE_CATEGORIES = Object.freeze(['academic', 'examination', 'placement', 'event', 'general']);
export const NOTICE_PRIORITIES = Object.freeze(['normal', 'important', 'urgent']);

export const safeNoticeUrl = (value) => {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
};
const safeDate = (value) => value && !Number.isNaN(new Date(value).getTime()) ? value : null;

export const normalizeNotice = (value) => {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.content !== 'string') return null;
  const attachments = Array.isArray(value.attachments) ? value.attachments.map((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.displayName !== 'string') return null;
    const secureUrl = safeNoticeUrl(item.secureUrl);
    if (!secureUrl || !['image', 'pdf', 'docx'].includes(item.kind)) return null;
    return { id: item.id, displayName: item.displayName, mimeType: String(item.mimeType || ''), size: Number(item.size) || 0, secureUrl, kind: item.kind, uploadedAt: safeDate(item.uploadedAt) };
  }).filter(Boolean).slice(0, 5) : [];
  return {
    id: value.id, title: value.title, content: value.content,
    category: NOTICE_CATEGORIES.includes(value.category) ? value.category : 'general',
    priority: NOTICE_PRIORITIES.includes(value.priority) ? value.priority : 'normal',
    targetScope: ['college', 'program', 'semester'].includes(value.targetScope) ? value.targetScope : 'college',
    attachmentUrl: safeNoticeUrl(value.attachmentUrl), attachmentLabel: typeof value.attachmentLabel === 'string' ? value.attachmentLabel : '',
    attachments,
    sourceUrl: safeNoticeUrl(value.sourceUrl), sourceLabel: typeof value.sourceLabel === 'string' ? value.sourceLabel : '',
    publishedAt: safeDate(value.publishedAt), expiresAt: safeDate(value.expiresAt),
    attribution: 'Published on CampusSwap'
  };
};

export const normalizeNoticeList = (payload) => {
  const notices = Array.isArray(payload?.data) ? payload.data.map(normalizeNotice).filter(Boolean) : [];
  const page = Number.isInteger(payload?.pagination?.page) ? payload.pagination.page : 1;
  const totalPages = Number.isInteger(payload?.pagination?.totalPages) ? payload.pagination.totalPages : 0;
  return { notices, pagination: { page, totalPages, total: Number(payload?.pagination?.total) || 0 } };
};

export const noticeScopeLabel = (scope) => ({ college: 'College-wide', program: 'Program notice', semester: 'Semester notice' }[scope] || 'Campus notice');
export const noticePreview = (content, limit = 220) => content.length <= limit ? content : `${content.slice(0, limit).trimEnd()}…`;
