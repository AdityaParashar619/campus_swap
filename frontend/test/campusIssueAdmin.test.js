import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildIssueReview, issueReviewActions, normalizeAdminIssue } from '../src/utils/campusIssueAdmin.js';

const submitted = { status: 'submitted', version: 0 };
const inReview = { status: 'under_review', version: 4 };

test('Campus Issues management uses the existing AdminRoute and Admin Panel', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/admin\/campus-issues"\s+element=\{<AdminRoute><AdminCampusIssues\s*\/><\/AdminRoute>\}/);
  assert.match(panel, /to="\/admin\/campus-issues"/);
});

test('review actions reflect backend transitions and terminal statuses', () => {
  assert.deepEqual(Object.keys(issueReviewActions('submitted')), ['under_review', 'closed']);
  assert.deepEqual(Object.keys(issueReviewActions('under_review')), ['under_review', 'resolved', 'closed']);
  for (const status of ['resolved', 'closed']) assert.deepEqual(issueReviewActions(status), {});
  assert.throws(() => buildIssueReview(submitted, 'resolved', 'A long enough note'), /unavailable/);
});

test('starting review uses version zero and updating review requires a response', () => {
  assert.deepEqual(buildIssueReview(submitted, 'under_review', ' '), { data: { status: 'under_review' }, ifMatch: '"0"' });
  assert.throws(() => buildIssueReview(inReview, 'under_review', ' '), /Enter a response/);
  assert.deepEqual(buildIssueReview(inReview, 'under_review', ' Latest response '), {
    data: { status: 'under_review', adminResponse: 'Latest response' }, ifMatch: '"4"'
  });
  assert.throws(() => buildIssueReview({ status: 'under_review' }, 'under_review', 'Text'), /Reload the report/);
});

test('resolution and closure require meaningful notes and send only the terminal note', () => {
  assert.throws(() => buildIssueReview(inReview, 'resolved', '  '), /resolution note/);
  assert.throws(() => buildIssueReview(submitted, 'closed', 'Too short'), /closure explanation/);
  assert.throws(() => buildIssueReview(inReview, 'under_review', 'a'.repeat(2001)), /at most 2000/);
  for (const status of ['resolved', 'closed']) {
    assert.deepEqual(buildIssueReview(inReview, status, ' Includes details. '), {
      data: { status, resolutionNote: 'Includes details.' }, ifMatch: '"4"'
    });
  }
});

test('admin responses require a valid version and omit reporter and reviewer identifiers', () => {
  const fixture = {
    id: '0123456789abcdef01234567', title: 'Fixture', description: 'Issue details', category: 'water',
    status: 'under_review', version: 4, reportedBy: 'private', reviewedBy: 'private',
    updatedAt: '2026-11-23T12:00:00.000Z'
  };
  const issue = normalizeAdminIssue(fixture);
  assert.equal(issue.version, 4);
  assert.equal(issue.updatedAt, fixture.updatedAt);
  assert.equal(Object.hasOwn(issue, 'reportedBy'), false);
  assert.equal(Object.hasOwn(issue, 'reviewedBy'), false);
  assert.equal(normalizeAdminIssue({ ...fixture, version: '4' }), null);
});
