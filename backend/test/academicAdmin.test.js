import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { requireRole } from '../middleware/authMiddleware.js';
import AcademicResource from '../models/AcademicResource.js';
import { assertPublishable } from '../controllers/academicAdminController.js';

const invoke = (middleware, user) => new Promise((resolve) => middleware({ user }, {}, (error) => resolve(error || null)));

test('academic management authorization allows only explicit trusted admin roles', async () => {
  const guard = requireRole('admin', 'college_admin', 'super_admin');
  for (const role of ['admin', 'college_admin', 'super_admin']) assert.equal(await invoke(guard, { role }), null);
  for (const role of ['student', 'marketplace_moderator', 'department_coordinator']) assert.equal((await invoke(guard, { role })).status, 403);
});

test('verified resources require an auditable verifier and timestamp', async () => {
  const owner = new mongoose.Types.ObjectId();
  const base = { title: 'CE resource', resourceType: 'syllabus', scope: 'program', departmentCode: 'CE', programCode: 'CE', semester: '5', academicSession: '2026-27', url: 'https://www.satiengg.in/ce.pdf', sourceType: 'official_external', verificationStatus: 'verified', createdBy: owner, updatedBy: owner };
  await assert.rejects(new AcademicResource({ ...base, lastVerifiedAt: new Date() }).validate(), /verifier/i);
  await new AcademicResource({ ...base, lastVerifiedAt: new Date(), verifiedBy: owner }).validate();
});

test('retired and unverified resource states remain distinct', async () => {
  const owner = new mongoose.Types.ObjectId();
  const item = new AcademicResource({ title: 'Draft', resourceType: 'other', scope: 'college', url: 'https://www.satiengg.in/', sourceType: 'official_external', verificationStatus: 'unverified', isActive: false, retiredAt: new Date(), createdBy: owner, updatedBy: owner, history: [{ actor: owner, action: 'retired', changedFields: ['isActive'] }] });
  await item.validate(); assert.equal(item.isActive, false); assert.equal(item.verificationStatus, 'unverified'); assert.equal(item.history.length, 1);
});

test('reference-only records require explicit program and semester classification', async () => {
  const owner = new mongoose.Types.ObjectId();
  const base = { title: 'Reference', resourceType: 'syllabus', resourceKind: 'exact_document', applicabilityMode: 'reference_only', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '7', url: 'https://www.satiengg.in/reference.pdf', sourceUrl: 'https://www.satiengg.in/syllabus-cse', sourceType: 'official_external', applicabilityEvidence: 'Official source reviewed.', uncertainty: 'Batch applicability unknown.', checkedAt: new Date(), createdBy: owner, updatedBy: owner };
  await new AcademicResource(base).validate();
  await assert.rejects(new AcademicResource({ ...base, semester: null }).validate(), /Reference documents require/i);
  await assert.rejects(new AcademicResource({ ...base, scope: 'department', programCode: null }).validate(), /Reference documents require/i);
});

test('publication state is distinct from verification and requires program plus semester for exact PDFs', async () => {
  const owner = new mongoose.Types.ObjectId();
  const base = { title: 'Published syllabus', resourceType: 'syllabus', resourceKind: 'exact_document', publicationStatus: 'published', scope: 'program', departmentCode: 'CSE', programCode: 'CSE', semester: '7', url: 'https://www.satiengg.in/cse7.pdf', sourceType: 'official_external', verificationStatus: 'unverified', isActive: true, createdBy: owner, updatedBy: owner };
  const published = new AcademicResource(base);
  await published.validate();
  assert.equal(published.publicationStatus, 'published');
  assert.equal(published.verificationStatus, 'unverified');
  await assert.rejects(new AcademicResource({ ...base, semester: null }).validate(), /canonical program and semester/i);
  await assert.rejects(new AcademicResource({ ...base, isActive: false }).validate(), /Retired resources/i);
});

test('unverified direct publication is development-only', () => {
  const item = { resourceKind: 'exact_document', resourceType: 'syllabus', scope: 'program', programCode: 'CSE', semester: '7', verificationStatus: 'unverified' };
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => assertPublishable(item));
    process.env.NODE_ENV = 'production';
    assert.throws(() => assertPublishable(item), /Production publication requires independent verification/i);
  } finally {
    if (previous == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
