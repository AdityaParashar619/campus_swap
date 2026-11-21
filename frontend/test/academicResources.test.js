import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { availabilityFor, buildAcademicResourcePayload, normalizeAcademicResponse, resourceStatusLabel, resourcesByCategory } from '../src/utils/academicResources.js';

const branches = ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee'];
const fixture = (registrationBranch, semester = '5') => ({ supported: true, identity: { registrationBranch, programCode: registrationBranch.toUpperCase(), programName: `Program ${registrationBranch}`, departmentCode: registrationBranch.toUpperCase(), semester, academicSession: null, admissionBatch: null }, resources: [], availability: { syllabus: { status: 'not_available' }, timetable: { status: 'not_available' } } });

test('all registered branches normalize without client-side remapping', () => {
  for (const branch of branches) assert.equal(normalizeAcademicResponse(fixture(branch)).identity.registrationBranch, branch);
});

test('CE semester 5 remains supported with explicit missing resources', () => {
  const data = normalizeAcademicResponse(fixture('ce', '5'));
  assert.equal(data.supported, true); assert.equal(data.resources.length, 0);
  assert.equal(availabilityFor(data, 'syllabus').status, 'not_available');
});

test('ME semester 3 groups multiple exact and department resources', () => {
  const data = normalizeAcademicResponse({ ...fixture('me', '3'), resources: [
    { id: '1', title: 'ME syllabus', resourceType: 'syllabus', matchStatus: 'exact_verified_match', applicabilityConfirmed: true, url: 'https://www.satiengg.in/me.pdf' },
    { id: '2', title: 'ME faculty', resourceType: 'faculty', matchStatus: 'department_resource', applicabilityConfirmed: true, url: 'https://www.satiengg.in/me' }
  ] });
  assert.equal(resourcesByCategory(data).syllabus.length, 1); assert.equal(resourcesByCategory(data).faculty.length, 1);
});

test('browsing fallbacks remain fallbacks and never exact documents', () => {
  const data = normalizeAcademicResponse({ ...fixture('cs', '7'), availability: { syllabus: { status: 'browsing_fallback', url: 'https://www.satiengg.in/syllabus-cse', isExactDocument: false } } });
  assert.deepEqual(availabilityFor(data, 'syllabus').status, 'browsing_fallback');
  assert.equal(availabilityFor(data, 'syllabus').isExactDocument, false);
});

test('resource-category fallbacks remain isolated and missing categories stay unavailable', () => {
  const data = normalizeAcademicResponse({ ...fixture('cs', '7'), availability: {
    syllabus: { status: 'browsing_fallback', resourceType: 'syllabus', url: 'https://www.satiengg.in/syllabus-cse', isExactDocument: false },
    department_overview: { status: 'browsing_fallback', resourceType: 'department_overview', url: 'https://www.satiengg.in/departments/computer-science-engineering', isExactDocument: false }
  } });
  assert.equal(availabilityFor(data, 'syllabus').url, 'https://www.satiengg.in/syllabus-cse');
  assert.equal(availabilityFor(data, 'timetable').status, 'not_available');
  assert.equal(availabilityFor(data, 'scheme').status, 'not_available');
  assert.equal(availabilityFor(data, 'department_overview').url, 'https://www.satiengg.in/departments/computer-science-engineering');
});

test('unconfirmed session or missing batch is labeled and does not gain a URL', () => {
  const data = normalizeAcademicResponse({ ...fixture('cs'), resources: [{ id: 'x', title: 'Old timetable', resourceType: 'timetable', matchStatus: 'session_or_batch_unconfirmed', applicabilityConfirmed: false, sourceUrl: null }] });
  assert.equal(data.resources[0].url, undefined);
  assert.match(resourceStatusLabel(data.resources[0].matchStatus), /unconfirmed/i);
});

test('official references keep their URL but remain explicitly non-applicable', () => {
  const data = normalizeAcademicResponse({ ...fixture('cs', '7'), resources: [{ id: 'ref', title: 'Historical CSE syllabus', resourceType: 'syllabus', matchStatus: 'official_reference', applicabilityConfirmed: false, referenceOnly: true, academicSession: '2025-26', uncertainty: 'Batch applicability unknown.', url: 'https://www.satiengg.in/reference.pdf' }] });
  assert.equal(data.resources[0].url, 'https://www.satiengg.in/reference.pdf');
  assert.match(resourceStatusLabel(data.resources[0].matchStatus), /Reference only/i);
  assert.equal(resourcesByCategory(data).syllabus.length, 1);
});

test('published matching PDFs remain visible with a concise neutral label', () => {
  const data = normalizeAcademicResponse({ ...fixture('cs', '7'), resources: [{ id: 'published', title: 'Published CSE 7 syllabus', resourceType: 'syllabus', matchStatus: 'published_reference', publicationStatus: 'published', applicabilityConfirmed: false, referenceOnly: true, semester: '7', url: 'https://www.satiengg.in/cse7.pdf' }] });
  assert.equal(data.resources[0].url, 'https://www.satiengg.in/cse7.pdf');
  assert.equal(resourceStatusLabel(data.resources[0].matchStatus), 'Published resource');
});

test('closed advanced metadata remains in edit submissions', () => {
  const payload = buildAcademicResourcePayload({ title: 'CSE syllabus', academicSession: '2025-26', admissionBatch: '2023', applicabilityEvidence: 'Reviewed source' }, 'published');
  assert.equal(payload.academicSession, '2025-26');
  assert.equal(payload.admissionBatch, '2023');
  assert.equal(payload.applicabilityEvidence, 'Reviewed source');
  assert.equal(payload.publicationStatus, 'published');
});

test('empty and malformed API data fail safely', () => {
  for (const value of [null, undefined, '', {}, { resources: [null, {}, { title: 4 }] }]) {
    const data = normalizeAcademicResponse(value); assert.equal(data.supported, false); assert.deepEqual(data.resources, []);
  }
});

test('page has loading, retry, safe external links, protected route, and no academic selectors', () => {
  const page = fs.readFileSync(new URL('../src/pages/MyDepartment.jsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(page, /Loading academic resources/); assert.match(page, />Retry</);
  assert.match(page, /target="_blank" rel="noopener noreferrer"/);
  assert.match(page, /Open Syllabus PDF/); assert.match(page, /Open Timetable PDF/);
  assert.match(page, /View reference PDF/); assert.match(page, /Reference only — applicability unconfirmed/);
  assert.doesNotMatch(page, /This published document matches your program and semester/);
  assert.match(page, /Program:/); assert.match(page, /Semester:/);
  assert.match(page, /categoryResources\.length > 0 \?/);
  assert.doesNotMatch(page, /<select|branch.*onChange|semester.*onChange/i);
  assert.match(app, /path="\/my-department"[^\n]+ProtectedRoute/);
});

test('admin form keeps session and batch inside closed advanced details', () => {
  const page = fs.readFileSync(new URL('../src/pages/AdminAcademicResources.jsx', import.meta.url), 'utf8');
  assert.match(page, /<details[^>]*><summary[^>]*>Advanced details<\/summary>/);
  assert.match(page, /advancedFields\.map/);
  assert.doesNotMatch(page, /resourceKind === 'official_index'[\s\S]{0,160}academicSession/);
});
