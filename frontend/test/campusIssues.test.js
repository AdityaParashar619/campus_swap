import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildIssuePayload, issueSubmitError, ISSUE_CATEGORIES, ISSUE_STATUSES, normalizeIssue, normalizeIssueLocation, readIssuePage } from '../src/utils/campusIssues.js';
import { getNavigationLinks } from '../src/utils/navigation.js';

const id = '507f1f77bcf86cd799439011';
const form = { title: ' Synthetic issue ', description: ' Synthetic description ', category: 'water', locationDescription: '' };
const issue = { id, ...form, status: 'submitted' };

test('student routes are protected and preserve College Services and Community navigation', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const path of ['/campus-issues', '/campus-issues/new', '/campus-issues/:id']) {
    assert.ok(app.includes(`path="${path}" element={<ProtectedRoute studentOnly>`));
  }
  const destinations = getNavigationLinks('student').map((link) => link.href);
  for (const path of ['/campus-issues', '/campus-map', '/notices', '/bounties']) assert.ok(destinations.includes(path));
  assert.ok(!getNavigationLinks('admin').some((link) => link.href === '/campus-issues'));
});

test('only student fields are submitted and location choices are optional', () => {
  const expected = { title: 'Synthetic issue', description: 'Synthetic description', category: 'water' };
  assert.deepEqual(buildIssuePayload({ ...form, status: 'resolved', createdBy: id, reviewedBy: id, attachmentUrl: 'https://example.invalid' }), expected);
  assert.deepEqual(buildIssuePayload({ ...form, campusLocation: id, locationDescription: ' East hall ' }),
    { ...expected, campusLocation: id, locationDescription: 'East hall' });
});

test('required fields, backend limits and invalid location IDs are validated', () => {
  for (const item of [{ title: ' ' }, { description: ' ' }, { category: 'unknown' },
    { title: 'a'.repeat(121) }, { description: 'a'.repeat(3001) }, { locationDescription: 'a'.repeat(301) },
    { campusLocation: 'missing' }]) assert.throws(() => buildIssuePayload({ ...form, ...item }));
  assert.equal(buildIssuePayload({ ...form, title: 'a'.repeat(120), description: 'a'.repeat(3000) }).title.length, 120);
});

test('category and status values match the backend without treating closed as resolved', () => {
  assert.deepEqual(Object.keys(ISSUE_CATEGORIES), ['infrastructure', 'cleanliness', 'water', 'electricity', 'internet', 'library', 'hostel', 'accessibility', 'other']);
  assert.deepEqual(ISSUE_STATUSES, { submitted: 'Submitted', under_review: 'Under Review', resolved: 'Resolved', closed: 'Closed' });
  assert.equal(normalizeIssue({ ...issue, status: 'unexpected' }), null);
});

test('responses retain only student-facing text, dates and published location identity', () => {
  const result = normalizeIssue({
    ...issue, status: 'closed', description: '<script>Just text</script>', resolutionNote: 'Closed as a duplicate',
    campusLocation: { id, name: 'Fixture', coordinateSource: 'private' },
    createdBy: id, reviewedBy: id, version: 3, resolvedAt: 'bad date'
  });
  assert.equal(result.description, '<script>Just text</script>');
  assert.deepEqual(result.campusLocation, { id, name: 'Fixture' });
  assert.equal(result.resolutionNote, 'Closed as a duplicate');
  assert.equal(result.resolvedAt, null);
  for (const key of ['createdBy', 'reviewedBy', 'version']) assert.equal(key in result, false);
});

test('server pagination supports an empty catalogue and rejects malformed pages', () => {
  assert.deepEqual(readIssuePage({ success: true, data: [], pagination: { page: 1, totalPages: 0 } }, normalizeIssueLocation, 1),
    { data: [], totalPages: 0 });
  assert.equal(readIssuePage({ success: true, data: [issue], pagination: { page: 2, totalPages: 2 } }, normalizeIssue, 2).data[0].id, id);
  assert.throws(() => readIssuePage({ success: true, data: [], pagination: { page: 1, totalPages: 2 } }, normalizeIssue, 2));
  assert.throws(() => readIssuePage({ success: true, data: [null], pagination: { page: 1, totalPages: 2 } }, normalizeIssue, 1));
});

test('submission messages handle validation and rate limits without leaking unexpected errors', () => {
  assert.equal(issueSubmitError({ response: { status: 400, data: { message: 'Choose a published campus location' } } }), 'Choose a published campus location');
  assert.match(issueSubmitError({ response: { status: 429 } }), /Too many submissions/);
  assert.doesNotMatch(issueSubmitError({ response: { status: 500, data: { message: 'private trace' } } }), /private trace/);
});
