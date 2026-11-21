import { safeNoticeUrl } from './notices.js';

export const emptyNoticeForm = Object.freeze({ title: '', content: '', category: 'general', priority: 'normal', targetScope: 'college', targetPrograms: [], targetSemester: '', attachmentUrl: '', attachmentLabel: '', sourceUrl: '', sourceLabel: '', expiresAt: '', expiresAtOriginal: '', attachments: [] });

export const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const part = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
};

export const noticeToForm = (notice) => ({
  ...emptyNoticeForm, ...Object.fromEntries(Object.keys(emptyNoticeForm).map((key) => [key, notice?.[key] ?? emptyNoticeForm[key]])),
  targetPrograms: Array.isArray(notice?.targetPrograms) ? [...notice.targetPrograms] : [],
  attachments: Array.isArray(notice?.attachments) ? [...notice.attachments] : [],
  targetSemester: notice?.targetSemester == null ? '' : String(notice.targetSemester),
  expiresAt: toLocalDateTime(notice?.expiresAt), expiresAtOriginal: notice?.expiresAt || ''
});

export const validateNoticeForm = (form) => {
  if (!form.title.trim()) return 'Title is required.';
  if (!form.content.trim()) return 'Content is required.';
  if (form.targetScope !== 'college' && !form.targetPrograms.length) return 'Select at least one program.';
  if (form.targetScope === 'semester' && !/^[1-8]$/.test(String(form.targetSemester))) return 'Select a semester from 1 through 8.';
  for (const [field, value] of [['Attachment URL', form.attachmentUrl], ['Source URL', form.sourceUrl]]) if (value && !safeNoticeUrl(value)) return `${field} must be a valid HTTPS URL.`;
  if (form.expiresAt && Number.isNaN(new Date(form.expiresAt).getTime())) return 'Expiration date and time are invalid.';
  return '';
};

export const buildNoticePayload = (form) => ({
  title: form.title.trim(), content: form.content.trim(), category: form.category, priority: form.priority,
  targetScope: form.targetScope,
  targetPrograms: form.targetScope === 'college' ? [] : [...form.targetPrograms],
  targetSemester: form.targetScope === 'semester' ? Number(form.targetSemester) : null,
  attachmentUrl: form.attachmentUrl.trim() || null, attachmentLabel: form.attachmentLabel.trim(),
  sourceUrl: form.sourceUrl.trim() || null, sourceLabel: form.sourceLabel.trim(),
  expiresAt: form.expiresAt
    ? form.expiresAtOriginal && toLocalDateTime(form.expiresAtOriginal) === form.expiresAt ? form.expiresAtOriginal : new Date(form.expiresAt).toISOString()
    : null
});

export const targetAudienceLabel = (notice, programs = []) => {
  if (notice.targetScope === 'college') return 'College-wide';
  const labels = (notice.targetPrograms || []).map((code) => programs.find((program) => program.programCode === code)?.displayName || code);
  return `${labels.join(', ') || 'No program'}${notice.targetScope === 'semester' ? ` · Semester ${notice.targetSemester}` : ''}`;
};
