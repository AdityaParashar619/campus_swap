import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import Notice from '../models/Notice.js';
import { buildStudentNoticeFilter, serializeStudentNotice } from '../services/noticeService.js';
import { assertNoticePublishable, escapeSearch, normalizeNoticeInput, parseNoticePagination } from '../utils/noticeValidation.js';

const owner = () => new mongoose.Types.ObjectId();
const base = (overrides = {}) => ({ title: 'Semester registration', content: 'Complete registration before Friday.', targetScope: 'college', createdBy: owner(), updatedBy: owner(), ...overrides });

test('Notice validates college, program, and semester targeting against canonical programs', async () => {
  await new Notice(base()).validate();
  await new Notice(base({ targetScope: 'program', targetPrograms: ['CSE'] })).validate();
  await new Notice(base({ targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: 7 })).validate();
  await assert.rejects(new Notice(base({ targetScope: 'program', targetPrograms: [] })).validate(), /require programs/i);
  await assert.rejects(new Notice(base({ targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: 9 })).validate());
  await assert.rejects(new Notice(base({ targetScope: 'program', targetPrograms: ['UNKNOWN'] })).validate());
});

test('Notice rejects unsafe URLs and enforces lifecycle timestamps', async () => {
  await assert.rejects(new Notice(base({ attachmentUrl: 'javascript:alert(1)' })).validate(), /HTTPS/i);
  await assert.rejects(new Notice(base({ status: 'published' })).validate(), /publishedAt/i);
  await assert.rejects(new Notice(base({ status: 'archived' })).validate(), /archivedAt/i);
});

test('notice input rejects protected fields, unsafe URLs, invalid programs, and invalid semesters', () => {
  assert.throws(() => normalizeNoticeInput({ ...base(), createdBy: owner() }), /Unexpected fields/);
  assert.throws(() => normalizeNoticeInput({ title: 'x', content: 'y', attachmentUrl: 'data:text/plain,x' }), /HTTPS/i);
  assert.throws(() => normalizeNoticeInput({ title: 'x', content: 'y', targetPrograms: ['nope'] }), /Unknown canonical/);
  assert.throws(() => normalizeNoticeInput({ title: 'x', content: 'y', targetSemester: 0 }), /1 through 8/);
});

test('publication rejects expired notices while ordinary edits do not manufacture timestamps', () => {
  assert.throws(() => assertNoticePublishable(base({ expiresAt: new Date(Date.now() - 1000) })), /expiration/i);
  const future = base({ expiresAt: new Date(Date.now() + 60000) });
  assert.doesNotThrow(() => assertNoticePublishable(future));
  assert.equal(future.publishedAt, undefined);
});

test('student filters derive identity from profile and preserve program plus semester isolation', () => {
  const now = new Date('2026-11-21T00:00:00Z');
  const cse7 = buildStudentNoticeFilter({ branch: 'cs', semester: '7' }, {}, now);
  const scopes = cse7.$and[1].$or;
  assert.ok(scopes.some((scope) => scope.targetScope === 'college'));
  assert.ok(scopes.some((scope) => scope.targetScope === 'program' && scope.targetPrograms === 'CSE'));
  assert.ok(scopes.some((scope) => scope.targetScope === 'semester' && scope.targetPrograms === 'CSE' && scope.targetSemester === 7));
  assert.equal(scopes.some((scope) => scope.targetPrograms === 'ECE'), false);
});

test('pagination and search are bounded and escaped', () => {
  assert.deepEqual(parseNoticePagination({ page: '2', limit: '10' }), { page: 2, limit: 10, skip: 10 });
  assert.throws(() => parseNoticePagination({ limit: '51' }), /1 through 50/);
  assert.equal(escapeSearch('exam.*(x)'), 'exam\\.\\*\\(x\\)');
});

test('student serialization excludes admin identity and uses neutral attribution', () => {
  const output = serializeStudentNotice({ ...base(), _id: owner(), category: 'general', priority: 'normal', publishedAt: new Date(), createdBy: owner(), updatedBy: owner() });
  assert.equal(output.attribution, 'Published on CampusSwap');
  assert.equal('createdBy' in output, false);
  assert.equal('updatedBy' in output, false);
  assert.equal('status' in output, false);
});
