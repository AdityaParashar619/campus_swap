import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildNoticePayload, emptyNoticeForm, noticeToForm, targetAudienceLabel, toLocalDateTime, validateNoticeForm } from '../src/utils/noticeAdmin.js';

const valid = () => ({ ...emptyNoticeForm, targetPrograms: [], title: 'Registration', content: 'Complete registration.', expiresAtOriginal: '' });

test('admin notice payload contains only backend-supported editable fields', () => {
  const payload = buildNoticePayload({ ...valid(), targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: '7' });
  assert.deepEqual(payload.targetPrograms, ['CSE']); assert.equal(payload.targetSemester, 7);
  for (const protectedField of ['status', 'createdBy', 'updatedBy', 'publishedAt', 'archivedAt', 'expiresAtOriginal']) assert.equal(protectedField in payload, false);
});

test('target validation rejects missing programs, semesters, and unsafe URLs', () => {
  assert.match(validateNoticeForm({ ...valid(), targetScope: 'program' }), /at least one program/i);
  assert.match(validateNoticeForm({ ...valid(), targetScope: 'semester', targetPrograms: ['CSE'] }), /semester/i);
  assert.match(validateNoticeForm({ ...valid(), attachmentUrl: 'javascript:alert(1)' }), /HTTPS/i);
  assert.equal(validateNoticeForm({ ...valid(), targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: '7', sourceUrl: 'https://www.satiengg.in/notices' }), '');
});

test('untouched expiration preserves the exact stored timestamp', () => {
  const stored = '2026-12-01T10:20:37.456Z';
  const form = noticeToForm({ ...valid(), expiresAt: stored });
  assert.equal(form.expiresAt, toLocalDateTime(stored));
  assert.equal(buildNoticePayload({ ...form, title: 'Edited title' }).expiresAt, stored);
});

test('edited browser-local expiration converts to an ISO timestamp', () => {
  const form = { ...valid(), expiresAt: '2026-12-01T10:20', expiresAtOriginal: '' };
  assert.equal(buildNoticePayload(form).expiresAt, new Date('2026-12-01T10:20').toISOString());
});

test('audience labels use authoritative program metadata', () => {
  const programs = [{ programCode: 'CSE', displayName: 'Computer Science and Engineering' }];
  assert.equal(targetAudienceLabel({ targetScope: 'college' }, programs), 'College-wide');
  assert.equal(targetAudienceLabel({ targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: 7 }, programs), 'Computer Science and Engineering · Semester 7');
});

test('admin page implements lifecycle, filters, failure preservation, and duplicate guards', () => {
  const page = fs.readFileSync(new URL('../src/pages/AdminNotices.jsx', import.meta.url), 'utf8');
  for (const phrase of ['Notice Management', 'Create Notice', 'Save Draft', 'Save Changes', 'Publish', 'Archive', 'Republish', 'Search', 'Status filter', 'Category filter']) assert.match(page, new RegExp(phrase));
  assert.match(page, /if \(submitting\) return/); assert.match(page, /disabled=\{submitting\}/);
  assert.match(page, /catch \(error\).*Notice could not be saved/);
  assert.doesNotMatch(page, /catch \(error\)[^}]+reset\(\)/);
  assert.match(page, /window\.confirm/); assert.match(page, /AbortController/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

test('admin Notice route uses existing role guard and dashboard integration', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/admin\/notices"[^\n]+AdminRoute><AdminNotices/);
  assert.match(admin, /to="\/admin\/notices"[^>]*>Notice management/);
});
