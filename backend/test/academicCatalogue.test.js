import assert from 'node:assert/strict';
import test from 'node:test';
import { academicCoverageCatalogue, directAcademicDocumentCandidates, importableAcademicCatalogue } from '../data/academicResourceCatalogue.js';
import { academicPrograms } from '../utils/academicPrograms.js';

const types = ['syllabus', 'timetable', 'scheme', 'faculty', 'department_overview', 'academic_calendar'];

test('curation coverage explicitly represents all ten programs and six resource types', () => {
  assert.equal(academicCoverageCatalogue.length, 60);
  for (const program of academicPrograms) {
    const rows = academicCoverageCatalogue.filter((row) => row.programCode === program.programCode);
    assert.deepEqual(rows.map((row) => row.resourceType), types);
    assert.ok(rows.every((row) => row.semesters.length === 8));
  }
});

test('direct document candidates remain unverified and outside the automatic import set', () => {
  assert.equal(directAcademicDocumentCandidates.length, 2);
  for (const candidate of directAcademicDocumentCandidates) {
    assert.equal(candidate.resourceKind, 'exact_document');
    assert.equal(candidate.verificationStatus, 'unverified');
    assert.ok(candidate.academicSession);
    assert.equal(importableAcademicCatalogue.some(({ url }) => url === candidate.url), false);
  }
});

test('every importable item is an unambiguous official browsing index with provenance', () => {
  assert.ok(importableAcademicCatalogue.length > 0);
  for (const item of importableAcademicCatalogue) {
    assert.equal(item.resourceKind, 'official_index');
    assert.equal(item.semester, null);
    assert.equal(item.academicSession, null);
    assert.equal(item.admissionBatch, null);
    assert.match(item.url, /^https:\/\/www\.satiengg\.in\//);
    assert.ok(item.applicabilityEvidence);
    assert.ok(item.uncertainty);
    assert.ok(item.checkedAt);
  }
});
