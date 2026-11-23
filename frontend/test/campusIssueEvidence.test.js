import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIssue, validateIssuePhotos } from '../src/utils/campusIssues.js';
import { normalizeAdminIssue } from '../src/utils/campusIssueAdmin.js';

const id = '507f1f77bcf86cd799439011';
const issue = { id, title: 'Water report', description: 'Synthetic report', category: 'water', status: 'submitted', version: 0 };
const photo = { type: 'image/png', size: 5 * 1024 * 1024 };

test('photo selection bounds each file and the combined selection', () => {
  assert.doesNotThrow(() => validateIssuePhotos([photo], 2));
  assert.doesNotThrow(() => validateIssuePhotos([{ type: 'image/jpeg', size: 1 }, { type: 'image/webp', size: 1 }]));
  assert.throws(() => validateIssuePhotos([photo, photo], 2), /at most 3/);
  assert.throws(() => validateIssuePhotos([{ ...photo, size: photo.size + 1 }]), /5 MB/);
  assert.throws(() => validateIssuePhotos([{ ...photo, size: 0 }]), /nonempty/);
  assert.throws(() => validateIssuePhotos([{ ...photo, type: 'image/svg+xml' }]), /Only JPEG/);
});

test('evidence accepts only bounded opaque IDs and ignores arbitrary image URLs', () => {
  const result = normalizeIssue({
    ...issue, evidence: [{ id: 'https://unknown.invalid' }, { id, url: 'https://unknown.invalid' }, { id }, { id }, { id }]
  });
  assert.deepEqual(result.evidence, [{ id }, { id }, { id }]);
  assert.equal(normalizeIssue(issue).evidence, undefined);
});

test('only an explicit admin detail flag enables test deletion', () => {
  assert.equal(normalizeAdminIssue({ ...issue, title: 'test sample', testFixture: true }).canDeleteTestReport, false);
  assert.equal(normalizeAdminIssue({ ...issue, canDeleteTestReport: 'true' }).canDeleteTestReport, false);
  const flags = { canDeleteTestReport: true, cleanupPending: true };
  assert.equal(normalizeAdminIssue({ ...issue, ...flags }).canDeleteTestReport, true);
  assert.equal(normalizeAdminIssue({ ...issue, ...flags }).cleanupPending, true);
  assert.equal(normalizeIssue({ ...issue, ...flags }).canDeleteTestReport, undefined);
});
