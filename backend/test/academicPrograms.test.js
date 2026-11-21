import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import AcademicResource from '../models/AcademicResource.js';
import { academicPrograms, assertAcademicRegistryCoverage, resolveAcademicProgram } from '../utils/academicPrograms.js';
import { buildPersonalizedAcademicResources } from '../services/academicResourceService.js';

const branches = ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee'];
const id = () => new mongoose.Types.ObjectId();
const resource = (overrides = {}) => ({
  _id: id(), title: 'Resource', description: '', resourceType: 'syllabus', scope: 'program',
  departmentCode: 'CSE', programCode: 'CSE', semester: '3', academicSession: null,
  admissionBatch: null, url: 'https://www.satiengg.in/resource', sourceUrl: null,
  sourceType: 'official_external', resourceKind: 'exact_document', publicationStatus: 'draft', verificationStatus: 'verified', lastVerifiedAt: new Date(), ...overrides
});
const modelWith = (records) => ({
  find(query) {
    const matching = records.filter((item) => item.isActive !== false && (item.publicationStatus === 'published' || item.verificationStatus === 'verified') &&
      (item.semester == null || query.semester.$in.includes(item.semester)) && query.$or.some((scope) =>
        item.scope === scope.scope && item.departmentCode === scope.departmentCode && item.programCode === scope.programCode));
    return { sort: () => ({ lean: async () => matching }) };
  }
});

test('registry explicitly covers every configured registration code and case-normalizes only validated aliases', () => {
  assert.deepEqual(academicPrograms.map(({ registrationCode }) => registrationCode), branches);
  assert.equal(assertAcademicRegistryCoverage(branches), true);
  for (const branch of branches) {
    assert.equal(resolveAcademicProgram(branch)?.registrationCode, branch);
    assert.equal(resolveAcademicProgram(branch.toUpperCase())?.registrationCode, branch);
  }
  assert.equal(resolveAcademicProgram('cse'), null);
  assert.equal(resolveAcademicProgram('unknown'), null);
});

test('CSE and CSE-BC remain distinct programs', () => {
  assert.equal(resolveAcademicProgram('cs').programCode, 'CSE');
  assert.equal(resolveAcademicProgram('bc').programCode, 'CSE_BC');
  assert.notEqual(resolveAcademicProgram('cs').programCode, resolveAcademicProgram('bc').programCode);
});

test('all registered branches and semesters return an honest successful empty state', async () => {
  for (const branch of branches) {
    for (let semester = 1; semester <= 8; semester += 1) {
      const result = await buildPersonalizedAcademicResources({ branch, semester: String(semester) }, { ResourceModel: modelWith([]) });
      assert.equal(result.supported, true, `${branch} semester ${semester}`);
      assert.equal(result.resources.length, 0);
      for (const type of ['syllabus', 'timetable', 'scheme', 'faculty', 'department_overview', 'academic_calendar']) assert.equal(result.availability[type].status, 'not_available');
    }
  }
});

test('CE semester 5 supports both missing and exact resources', async () => {
  const empty = await buildPersonalizedAcademicResources({ branch: 'ce', semester: '5' }, { ResourceModel: modelWith([]) });
  assert.notEqual(empty.availability.syllabus.status, 'exact_verified_match');
  const exactResource = resource({ departmentCode: 'CE', programCode: 'CE', semester: '5', academicSession: '2025-26' });
  const exact = await buildPersonalizedAcademicResources({ branch: 'ce', semester: '5', academicSession: '2025-26' }, { ResourceModel: modelWith([exactResource]) });
  assert.equal(exact.availability.syllabus.status, 'exact_verified_match');
});

test('verified documents without applicability metadata remain visible as labeled references', async () => {
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '3', academicSession: '2025-26' }, { ResourceModel: modelWith([
    resource({ title: 'Unscoped syllabus' }),
    resource({ title: 'Unscoped timetable', resourceType: 'timetable' })
  ]) });
  assert.notEqual(result.availability.syllabus.status, 'exact_verified_match');
  assert.notEqual(result.availability.timetable.status, 'exact_verified_match');
  assert.ok(result.resources.every(({ matchStatus, applicabilityConfirmed, url }) => matchStatus === 'published_reference' && !applicabilityConfirmed && url));
});

test('matching isolates program, department, semester and college scopes', async () => {
  const records = [
    resource({ title: 'CSE sem 3', programCode: 'CSE' }),
    resource({ title: 'Blockchain sem 3', programCode: 'CSE_BC' }),
    resource({ title: 'ME sem 3', departmentCode: 'ME', programCode: 'ME' }),
    resource({ title: 'ME sem 5', departmentCode: 'ME', programCode: 'ME', semester: '5' }),
    resource({ title: 'IT all-semester', departmentCode: 'IT', programCode: 'IT', semester: null }),
    resource({ title: 'CSE department', resourceType: 'faculty', scope: 'department', departmentCode: 'CSE', programCode: null, semester: null }),
    resource({ title: 'College calendar', resourceType: 'academic_calendar', scope: 'college', departmentCode: null, programCode: null, semester: null })
  ];
  const cse = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '3' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(cse.resources.map(({ title }) => title).sort(), ['CSE department', 'CSE sem 3', 'College calendar']);
  const me = await buildPersonalizedAcademicResources({ branch: 'me', semester: '3' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(me.resources.map(({ title }) => title).sort(), ['College calendar', 'ME sem 3']);
  const it = await buildPersonalizedAcademicResources({ branch: 'it', semester: '7' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(it.resources.map(({ title }) => title).sort(), ['College calendar', 'IT all-semester']);
});

test('optional session and batch metadata do not block reference visibility', async () => {
  const records = [
    resource({ title: 'Old timetable', resourceType: 'timetable', academicSession: '2023-24' }),
    resource({ title: 'Batch syllabus', admissionBatch: '2023' })
  ];
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '3' }, { ResourceModel: modelWith(records) });
  assert.ok(result.resources.every(({ matchStatus, applicabilityConfirmed, url }) => matchStatus === 'published_reference' && !applicabilityConfirmed && url));
  assert.notEqual(result.availability.syllabus.status, 'exact_verified_match');
  assert.notEqual(result.availability.timetable.status, 'exact_verified_match');
});

test('verified CSE semester 7 reference exposes its official URL without claiming applicability', async () => {
  const reference = resource({
    title: 'CSE 7 reference syllabus', semester: '7', academicSession: '2025-26', admissionBatch: '2023',
    applicabilityMode: 'reference_only', sourceUrl: 'https://www.satiengg.in/syllabus-cse',
    applicabilityEvidence: 'Official CSE Semester VII document.', uncertainty: 'Student batch applicability is unconfirmed.'
  });
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' }, { ResourceModel: modelWith([reference]) });
  assert.equal(result.resources[0].matchStatus, 'official_reference');
  assert.equal(result.resources[0].referenceOnly, true);
  assert.equal(result.resources[0].applicabilityConfirmed, false);
  assert.equal(result.resources[0].url, reference.url);
  assert.notEqual(result.availability.syllabus.status, 'exact_verified_match');
});

test('reference documents remain isolated by canonical program and semester', async () => {
  const records = [
    resource({ title: 'CSE 7 reference', semester: '7', applicabilityMode: 'reference_only' }),
    resource({ title: 'EC 5 reference', departmentCode: 'ECE', programCode: 'ECE', semester: '5', applicabilityMode: 'reference_only' }),
    resource({ title: 'EC 7 reference', departmentCode: 'ECE', programCode: 'ECE', semester: '7', applicabilityMode: 'reference_only' })
  ];
  const ec5 = await buildPersonalizedAcademicResources({ branch: 'ec', semester: '5' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(ec5.resources.map(({ title }) => title), ['EC 5 reference']);
  const cse7 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(cse7.resources.map(({ title }) => title), ['CSE 7 reference']);
});

test('known session and batch select an exact match while other matching-semester documents remain references', async () => {
  const records = [
    resource({ title: 'Matching syllabus', academicSession: '2025-26', admissionBatch: '2022' }),
    resource({ title: 'Wrong-session timetable', resourceType: 'timetable', academicSession: '2024-25' }),
    resource({ title: 'Wrong-batch syllabus', admissionBatch: '2021' })
  ];
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '3', academicSession: '2025-26', admissionBatch: '2022' }, { ResourceModel: modelWith(records) });
  assert.equal(result.availability.syllabus.status, 'exact_verified_match');
  assert.equal(result.availability.syllabus.resource.title, 'Matching syllabus');
  const references = result.resources.filter(({ title }) => title === 'Wrong-session timetable' || title === 'Wrong-batch syllabus');
  assert.equal(references.length, 2);
  assert.ok(references.every(({ matchStatus }) => matchStatus === 'published_reference'));
});

test('development-published unverified CSE semester 7 syllabus is visible only to its program and semester', async () => {
  const published = resource({ title: 'Published CSE 7 syllabus', semester: '7', academicSession: '2025-26', admissionBatch: '2023', publicationStatus: 'published', verificationStatus: 'unverified' });
  const cse7 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' }, { ResourceModel: modelWith([published]) });
  assert.equal(cse7.resources[0].matchStatus, 'published_reference');
  assert.equal(cse7.resources[0].url, published.url);
  const cse5 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '5' }, { ResourceModel: modelWith([published]) });
  assert.equal(cse5.resources.length, 0);
  const ec7 = await buildPersonalizedAcademicResources({ branch: 'ec', semester: '7' }, { ResourceModel: modelWith([published]) });
  assert.equal(ec7.resources.length, 0);
});

test('mandatory cross-program and cross-semester isolation holds', async () => {
  const records = [
    resource({ title: 'CSE 7', programCode: 'CSE', semester: '7', academicSession: '2025-26' }),
    resource({ title: 'EC 7', departmentCode: 'ECE', programCode: 'ECE', semester: '7', academicSession: '2025-26' }),
    resource({ title: 'EC 5', departmentCode: 'ECE', programCode: 'ECE', semester: '5', academicSession: '2025-26' }),
    resource({ title: 'ME 3', departmentCode: 'ME', programCode: 'ME', semester: '3', academicSession: '2025-26' }),
    resource({ title: 'IT 3', departmentCode: 'IT', programCode: 'IT', semester: '3', academicSession: '2025-26' })
  ];
  const ec5 = await buildPersonalizedAcademicResources({ branch: 'ec', semester: '5', academicSession: '2025-26' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(ec5.resources.map(({ title }) => title), ['EC 5']);
  const cse7 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7', academicSession: '2025-26' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(cse7.resources.map(({ title }) => title), ['CSE 7']);
  const me3 = await buildPersonalizedAcademicResources({ branch: 'me', semester: '3', academicSession: '2025-26' }, { ResourceModel: modelWith(records) });
  assert.deepEqual(me3.resources.map(({ title }) => title), ['ME 3']);
});

test('verified official indexes become labeled fallbacks rather than exact resources', async () => {
  const index = resource({ title: 'Official CSE syllabus index', semester: null, resourceKind: 'official_index' });
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' }, { ResourceModel: modelWith([index]) });
  assert.equal(result.resources.length, 0);
  assert.equal(result.availability.syllabus.status, 'browsing_fallback');
  assert.equal(result.availability.syllabus.isExactDocument, false);
  assert.equal(result.availability.syllabus.url, index.url);
});

test('fallbacks are category-specific and never synthesized from a department overview', async () => {
  const records = [
    resource({ title: 'Official CSE syllabus index', semester: null, resourceKind: 'official_index', url: 'https://www.satiengg.in/syllabus-cse' }),
    resource({ title: 'Official CSE department', resourceType: 'department_overview', semester: null, resourceKind: 'official_index', url: 'https://www.satiengg.in/departments/computer-science-engineering' })
  ];
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' }, { ResourceModel: modelWith(records) });
  assert.equal(result.availability.syllabus.url, 'https://www.satiengg.in/syllabus-cse');
  assert.equal(result.availability.department_overview.url, 'https://www.satiengg.in/departments/computer-science-engineering');
  assert.equal(result.availability.timetable.status, 'not_available');
  assert.equal(result.availability.scheme.status, 'not_available');
});

test('AcademicResource rejects unsafe URLs and invalid scope combinations', async () => {
  const base = { title: 'Unsafe', resourceType: 'syllabus', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '3', url: 'javascript:alert(1)', sourceType: 'official_external', createdBy: id(), updatedBy: id() };
  await assert.rejects(new AcademicResource(base).validate(), /safe HTTPS URL/i);
  await assert.rejects(new AcademicResource({ ...base, url: 'https://www.satiengg.in/resource', scope: 'college' }).validate(), /College resources/i);
  await assert.rejects(new AcademicResource({ ...base, url: 'https://www.satiengg.in/resource', resourceKind: 'official_index', semester: '3' }).validate(), /Official index pages/i);
  await assert.rejects(new AcademicResource({ ...base, url: 'https://www.satiengg.in/resource', applicabilityMode: 'reference_only', semester: null }).validate(), /Reference documents require/i);
  await assert.rejects(new AcademicResource({ ...base, url: 'https://www.satiengg.in/resource', resourceKind: 'official_index', applicabilityMode: 'reference_only', semester: null }).validate(), /browsing fallbacks/i);
});

test('inactive and unverified records are excluded by the database predicate', async () => {
  const records = [resource({ title: 'Inactive', isActive: false }), resource({ title: 'Unverified draft', verificationStatus: 'unverified', publicationStatus: 'draft' })];
  const result = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '3' }, { ResourceModel: modelWith(records) });
  assert.equal(result.resources.length, 0);
});
