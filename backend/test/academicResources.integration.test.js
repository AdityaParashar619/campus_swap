import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const testMongoUri = process.env.TEST_MONGO_URI || '';
if (testMongoUri) {
  const databaseName = new URL(testMongoUri).pathname.replace(/^\//, '').split('?')[0];
  if (!/_test$/i.test(databaseName)) throw new Error('TEST_MONGO_URI must target a database whose name ends with _test.');
}

import { env } from '../config/env.js';
import { createAcademicResource, updateAcademicResource, setAcademicResourceStatus } from '../controllers/academicAdminController.js';

const [{ default: mongoose }, { default: AcademicResource }, { buildPersonalizedAcademicResources }] = await Promise.all([
  import('mongoose'), import('../models/AcademicResource.js'), import('../services/academicResourceService.js')
]);

test('Mongo-backed academic resources remain central and enforce program/semester isolation', { skip: !testMongoUri }, async () => {
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 5000 });
  await AcademicResource.createIndexes();
  const owner = new mongoose.Types.ObjectId();
  const marker = `academic-integration-${crypto.randomUUID()}`;
  const ids = [];
  try {
    const created = await AcademicResource.create([
      { title: `${marker}-ce5`, resourceType: 'syllabus', scope: 'program', departmentCode: 'CE', programCode: 'CE', semester: '5', academicSession: '2025-26', publicationStatus: 'published', url: 'https://www.satiengg.in/syllabus-ce', sourceType: 'admin_verified', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
      { title: `${marker}-cse5`, resourceType: 'syllabus', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '5', academicSession: '2025-26', publicationStatus: 'published', url: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
      { title: `${marker}-calendar`, resourceType: 'academic_calendar', scope: 'college', publicationStatus: 'published', url: 'https://www.satiengg.in/academic-calendar', sourceType: 'official_external', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
      { title: `${marker}-cse7-reference`, resourceType: 'syllabus', resourceKind: 'exact_document', applicabilityMode: 'exact_applicable', publicationStatus: 'published', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '7', academicSession: '2025-26', admissionBatch: '2023', url: 'https://www.satiengg.in/cse7-reference.pdf', sourceUrl: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external', applicabilityEvidence: 'Official CSE Semester VII document.', uncertainty: 'Student applicability is unconfirmed.', checkedAt: new Date(), verificationStatus: 'unverified', createdBy: owner, updatedBy: owner }
    ]);
    ids.push(...created.map(({ _id }) => _id));

    const before = await AcademicResource.countDocuments({ _id: { $in: ids } });
    const ce = await buildPersonalizedAcademicResources({ branch: 'ce', semester: '5', academicSession: '2025-26' });
    const secondCeStudent = await buildPersonalizedAcademicResources({ branch: 'ce', semester: '5', academicSession: '2025-26' });
    assert.ok(ce.resources.some(({ title }) => title === `${marker}-ce5`));
    assert.ok(ce.resources.some(({ title }) => title === `${marker}-calendar`));
    assert.equal(ce.resources.some(({ title }) => title === `${marker}-cse5`), false);
    assert.equal(secondCeStudent.resources.length, ce.resources.length);
    assert.equal(await AcademicResource.countDocuments({ _id: { $in: ids } }), before, 'personalization must not duplicate resources per student');

    const ceSemester3 = await buildPersonalizedAcademicResources({ branch: 'ce', semester: '3', academicSession: '2025-26' });
    assert.equal(ceSemester3.resources.some(({ title }) => title === `${marker}-ce5`), false);
    const cse7 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' });
    const reference = cse7.resources.find(({ title }) => title === `${marker}-cse7-reference`);
    assert.equal(reference?.matchStatus, 'published_reference');
    assert.equal(reference?.url, 'https://www.satiengg.in/cse7-reference.pdf');
    const cse5 = await buildPersonalizedAcademicResources({ branch: 'cs', semester: '5' });
    assert.equal(cse5.resources.some(({ title }) => title === `${marker}-cse7-reference`), false);
  } finally {
    if (ids.length) await AcademicResource.deleteMany({ _id: { $in: ids } });
    await mongoose.disconnect();
  }
});

test('single faculty administrator saves, publishes, edits and retires a reviewed resource', { skip: !testMongoUri }, async () => {
  await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 5000 });
  const previous = { nodeEnv: env.nodeEnv, facultyDemoMode: env.facultyDemoMode };
  const actor = String(new mongoose.Types.ObjectId());
  const title = 'Faculty publication fixture ' + crypto.randomUUID();
  const invoke = (handler, body, id, userId = actor) => new Promise((resolve, reject) => handler(
    { body, params: { id }, user: { userId } },
    { status() { return this; }, json({ data }) { resolve(data); } }, reject
  ));
  const visible = async () => (await buildPersonalizedAcademicResources({ branch: 'cs', semester: '7' })).resources
    .some((item) => item.title === title);
  const payload = {
    title, resourceType: 'syllabus', resourceKind: 'exact_document', scope: 'program', programCode: 'CSE', semester: '7',
    publicationStatus: 'published', url: 'https://www.satiengg.in/' + crypto.randomUUID() + '.pdf',
    sourceUrl: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external',
    academicSession: '2025-26', admissionBatch: '2022', applicabilityEvidence: 'Reviewed against the program index.'
  };
  try {
    Object.assign(env, { nodeEnv: 'production', facultyDemoMode: false });
    await assert.rejects(invoke(createAcademicResource, payload), /independent verification/i);
    env.facultyDemoMode = true;
    const direct = await invoke(createAcademicResource, payload);
    assert.equal(direct.verificationStatus, 'unverified');
    assert.equal(direct.verifiedBy, null);
    assert.equal(direct.lastVerifiedAt, null);
    assert.equal(direct.history[0].action, 'faculty_created_and_published');
    assert.equal(await visible(), true);
    env.facultyDemoMode = false;
    assert.equal(await visible(), false);
    env.facultyDemoMode = true;
    await assert.rejects(invoke(setAcademicResourceStatus, { verificationStatus: 'verified' }, direct.id), /different administrator/i);
    const draft = await invoke(updateAcademicResource, { publicationStatus: 'draft' }, direct.id);
    assert.equal(draft.publishedAt, null);
    assert.equal(await visible(), false);
    const republished = await invoke(setAcademicResourceStatus, { publicationStatus: 'published' }, direct.id);
    assert.equal(republished.history.at(-1).action, 'faculty_published');
    const edited = await invoke(updateAcademicResource, { description: 'Edited fixture.', publicationStatus: 'published' }, direct.id);
    assert.equal(edited.academicSession, payload.academicSession);
    assert.equal(edited.admissionBatch, payload.admissionBatch);
    assert.equal(edited.applicabilityEvidence, payload.applicabilityEvidence);
    assert.equal(await visible(), true);
    const retired = await invoke(setAcademicResourceStatus, { isActive: false }, direct.id);
    assert.equal(retired.history.at(-1).action, 'retired');
    assert.equal(await visible(), false);
  } finally {
    Object.assign(env, previous);
    try { await AcademicResource.deleteMany({ createdBy: actor, title }); } finally { await mongoose.disconnect(); }
  }
});
