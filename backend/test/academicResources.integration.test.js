import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

const testMongoUri = process.env.TEST_MONGO_URI || '';
if (testMongoUri) {
  const databaseName = new URL(testMongoUri).pathname.replace(/^\//, '').split('?')[0];
  if (!/_test$/i.test(databaseName)) throw new Error('TEST_MONGO_URI must target a database whose name ends with _test.');
}

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
      { title: `${marker}-ce5`, resourceType: 'syllabus', scope: 'program', departmentCode: 'CE', programCode: 'CE', semester: '5', academicSession: '2025-26', url: 'https://www.satiengg.in/syllabus-ce', sourceType: 'admin_verified', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
      { title: `${marker}-cse5`, resourceType: 'syllabus', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '5', academicSession: '2025-26', url: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
      { title: `${marker}-calendar`, resourceType: 'academic_calendar', scope: 'college', url: 'https://www.satiengg.in/academic-calendar', sourceType: 'official_external', verificationStatus: 'verified', lastVerifiedAt: new Date(), verifiedBy: owner, createdBy: owner, updatedBy: owner },
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
