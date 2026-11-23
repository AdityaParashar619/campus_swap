import assert from 'node:assert/strict';
import test from 'node:test';
import CampusIssue from '../models/CampusIssue.js';
import { normalizeIssue, normalizeIssueReview, parseIssueList } from '../utils/campusIssueValidation.js';

const fixture = { title: ' Water supply ', description: ' Tap does not work. ', category: 'water' };

test('student submission validates required content, bounds and location type', () => {
  assert.equal(normalizeIssue(fixture).title, 'Water supply');
  assert.equal(normalizeIssue(fixture).campusLocation, null);
  for (const overrides of [
    { title: ' ' }, { description: '' }, { category: 'invalid' },
    { title: 'x'.repeat(121) }, { description: 'x'.repeat(3001) },
    { locationDescription: 'x'.repeat(301) }, { locationDescription: [] },
    { campusLocation: 'not-an-id' }, { campusLocation: { name: 'not accepted' } }
  ]) assert.throws(() => normalizeIssue({ ...fixture, ...overrides }), { status: 400 });
});

test('inputs reject forged audit fields, attachment URLs and student status', () => {
  for (const field of ['createdBy', 'status', 'reviewedBy', 'reviewedAt', 'resolvedAt', 'closedAt', 'adminResponse', 'resolutionNote', 'attachments', 'attachmentUrl']) {
    assert.throws(() => normalizeIssue({ ...fixture, [field]: 'forged' }), /Unexpected fields/);
  }
  assert.throws(() => normalizeIssueReview({ status: 'under_review', reviewedBy: 'forged' }, 'submitted'), /Unexpected fields/);
});

test('status transitions keep resolution and closure distinct and require notes', () => {
  assert.equal(normalizeIssueReview({ status: 'under_review' }, 'submitted').status, 'under_review');
  assert.throws(() => normalizeIssueReview({ status: 'resolved', resolutionNote: 'Synthetic resolution' }, 'submitted'), { status: 409 });
  assert.throws(() => normalizeIssueReview({ status: 'resolved' }, 'under_review'), { status: 400 });
  assert.throws(() => normalizeIssueReview({ status: 'closed', resolutionNote: 'short' }, 'submitted'), { status: 400 });
  assert.equal(normalizeIssueReview({ status: 'closed', resolutionNote: 'Duplicate of a tracked report.' }, 'submitted').status, 'closed');
  assert.throws(() => normalizeIssueReview({ status: 'closed', resolutionNote: 'Synthetic closure' }, 'resolved'), { status: 409 });
  assert.throws(() => normalizeIssueReview({ status: 'under_review' }, 'under_review'), { status: 400 });
  assert.equal(normalizeIssueReview({ status: 'under_review', adminResponse: 'We are looking at the fixture.' }, 'under_review').adminResponse, 'We are looking at the fixture.');
});

test('queries bound pagination and treat search punctuation literally', () => {
  const result = parseIssueList({ page: '2', limit: '5', status: 'closed', category: 'internet', search: 'Network .*' });
  assert.equal(result.skip, 5);
  assert.equal(result.filter.$or[0].title.test('network .*'), true);
  assert.equal(result.filter.$or[0].title.test('network outage'), false);
  for (const query of [{ limit: '51' }, { page: '10001' }, { search: 'x'.repeat(101) }, { createdBy: 'forged' }, { status: ['closed'] }]) {
    assert.throws(() => parseIssueList(query), { status: 400 });
  }
});

test('model defaults to submitted and requires an owner', async () => {
  const report = new CampusIssue(normalizeIssue(fixture));
  assert.equal(report.status, 'submitted');
  await assert.rejects(report.validate(), /createdBy/);
  report.createdBy = '507f1f77bcf86cd799439011';
  await report.validate();
  assert.equal(report.attachments, undefined);
});
