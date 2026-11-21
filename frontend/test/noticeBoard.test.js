import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { normalizeNotice, normalizeNoticeList, noticePreview, noticeScopeLabel, safeNoticeUrl } from '../src/utils/notices.js';

const fixture = (overrides = {}) => ({ id: '507f1f77bcf86cd799439011', title: 'Exam form', content: 'Complete the exam form.', category: 'examination', priority: 'urgent', targetScope: 'semester', publishedAt: '2026-11-21T00:00:00.000Z', attribution: 'Published on CampusSwap', ...overrides });

test('notice normalization preserves student-safe metadata and neutral attribution', () => {
  const notice = normalizeNotice(fixture({ attachmentUrl: 'https://www.satiengg.in/exam.pdf' }));
  assert.equal(notice.title, 'Exam form');
  assert.equal(notice.attachmentUrl, 'https://www.satiengg.in/exam.pdf');
  assert.equal(notice.attribution, 'Published on CampusSwap');
  assert.equal(noticeScopeLabel(notice.targetScope), 'Semester notice');
});

test('unsafe and malformed external URLs are never retained as links', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'http://example.com', 'not a URL', null]) assert.equal(safeNoticeUrl(value), '');
  assert.equal(normalizeNotice(fixture({ attachmentUrl: 'javascript:alert(1)', sourceUrl: 'data:text/html,x' })).attachmentUrl, '');
});

test('notice attachments retain only safe supported student metadata', () => {
  const notice = normalizeNotice(fixture({ attachments: [
    { id: 'a', displayName: 'poster.png', mimeType: 'image/png', size: 1024, secureUrl: 'https://res.cloudinary.com/test/image/upload/poster.png', kind: 'image' },
    { id: 'b', displayName: 'unsafe', secureUrl: 'javascript:alert(1)', kind: 'pdf' },
    { id: 'c', displayName: 'script.svg', secureUrl: 'https://example.com/script.svg', kind: 'svg' }
  ] }));
  assert.equal(notice.attachments.length, 1);
  assert.equal(notice.attachments[0].displayName, 'poster.png');
});

test('notice content stays plain text and previews are bounded', () => {
  const content = '<img src=x onerror=alert(1)>\n<script>alert(1)</script>';
  assert.equal(normalizeNotice(fixture({ content })).content, content);
  assert.equal(noticePreview('a'.repeat(230)).length, 221);
});

test('notice lists normalize pagination and reject malformed records', () => {
  const result = normalizeNoticeList({ data: [fixture(), null, { title: 4 }], pagination: { page: 2, totalPages: 3, total: 21 } });
  assert.equal(result.notices.length, 1);
  assert.deepEqual(result.pagination, { page: 2, totalPages: 3, total: 21 });
});

test('Notice Board implements loading, empty, error, retry, filters, pagination, and stale-request protection', () => {
  const page = fs.readFileSync(new URL('../src/pages/NoticeBoard.jsx', import.meta.url), 'utf8');
  for (const phrase of ['Campus Notice Board', 'Announcements relevant to your campus life', 'Loading notices', 'No notices available', 'New announcements will appear here when they are published.', 'Unable to load notices', 'Retry', 'View Details', 'Previous', 'Next']) assert.match(page, new RegExp(phrase));
  assert.match(page, /search: debouncedSearch/); assert.match(page, /category: filters\.category/); assert.match(page, /priority: filters\.priority/);
  assert.match(page, /page: filters\.page/); assert.match(page, /AbortController/); assert.match(page, /requestId/);
  assert.doesNotMatch(page, /targetProgram|targetSemester|admin\/notices/);
});

test('notice details use plain React text and secure HTTPS-only external links', () => {
  const page = fs.readFileSync(new URL('../src/pages/NoticeDetails.jsx', import.meta.url), 'utf8');
  assert.match(page, /whitespace-pre-wrap/); assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.match(page, /target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"/);
  assert.match(page, /Notice unavailable/); assert.match(page, /Back to Notice Board/);
  for (const text of ['Notice poster:', 'Open PDF', 'Download', 'Attached Posters / Images', 'Attached PDF Documents', 'Other Documents']) assert.match(page, new RegExp(text));
  assert.match(page, /images\.length > 0/); assert.match(page, /pdfs\.length > 0/); assert.match(page, /documents\.length > 0/);
  assert.match(page, /h-auto max-h-\[70vh\] w-full[^\n]+object-contain/);
  assert.match(page, /sm:grid-cols-2/); assert.match(page, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(page, /Preview availability depends on browser and file-provider support/);
  assert.match(page, /Preview unavailable:/); assert.match(page, /Preview PDF/); assert.match(page, /Hide PDF preview/);
  assert.doesNotMatch(page, /createdBy|updatedBy|archivedAt|admin/);
});

test('Notice routes are protected and no student admin controls are introduced', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const board = fs.readFileSync(new URL('../src/pages/NoticeBoard.jsx', import.meta.url), 'utf8');
  const details = fs.readFileSync(new URL('../src/pages/NoticeDetails.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/notices"[^\n]+ProtectedRoute><NoticeBoard/);
  assert.match(app, /path="\/notices\/:id"[^\n]+ProtectedRoute><NoticeDetails/);
  assert.doesNotMatch(`${board}\n${details}`, /adminAPI|Publish notice|Archive notice|Edit notice/);
});
