import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import AcademicResource from '../models/AcademicResource.js';
import User from '../models/User.js';
import { importableAcademicCatalogue } from '../data/academicResourceCatalogue.js';
import { getAcademicProgram } from '../utils/academicPrograms.js';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.length ? value.join('=') : true];
}));
const database = String(args.database || '').trim();
const execute = args.execute === true;
const rollbackBatch = typeof args['rollback-batch'] === 'string' ? args['rollback-batch'].trim() : '';
const expectedConfirmation = rollbackBatch ? `ROLLBACK_ACADEMIC_IMPORT_${database}` : `IMPORT_ACADEMIC_RESOURCES_${database}`;
const uri = process.env.MONGO_URI || '';
const uriDatabase = (() => {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
})();

if (!database || !uri || database !== uriDatabase) throw new Error('Provide --database matching the explicit MONGO_URI database name');
if (/prod/i.test(database) || process.env.NODE_ENV === 'production') throw new Error('Academic catalogue import refuses production targets');
if (execute && !database.endsWith('_test')) {
  const allowlist = new Set(String(process.env.ACADEMIC_IMPORT_ALLOWED_DATABASES || '').split(',').map((item) => item.trim()).filter(Boolean));
  if (!allowlist.has(database)) throw new Error('Non-test execution requires ACADEMIC_IMPORT_ALLOWED_DATABASES to contain the exact database');
  if (args.confirm !== expectedConfirmation) throw new Error(`Non-test execution requires --confirm=${expectedConfirmation}`);
}
if (rollbackBatch && (!execute || args.confirm !== expectedConfirmation)) throw new Error(`Rollback requires --execute --confirm=${expectedConfirmation}`);

await mongoose.connect(uri);
try {
  if (rollbackBatch) {
    const query = { importBatchId: rollbackBatch, verificationStatus: 'unverified', verifiedBy: null };
    const count = await AcademicResource.countDocuments(query);
    const result = await AcademicResource.deleteMany(query);
    console.log(JSON.stringify({ mode: 'rollback', database, batch: rollbackBatch, eligible: count, deleted: result.deletedCount }, null, 2));
    process.exitCode = 0;
  } else {
    const actorId = typeof args['actor-id'] === 'string' ? args['actor-id'] : null;
    let actor = null;
    if (execute) {
      if (!mongoose.isValidObjectId(actorId)) throw new Error('Execution requires a legitimate --actor-id');
      actor = await User.findById(actorId).select('_id role accountStatus').lean();
      if (!actor || !['admin', 'college_admin', 'super_admin'].includes(actor.role) || actor.accountStatus !== 'active') throw new Error('Import actor must be an active trusted administrator');
    }
    const validationActor = actor?._id || new mongoose.Types.ObjectId();
    const preview = { inserts: [], skips: [], conflicts: [], invalid: [] };
    for (const item of importableAcademicCatalogue) {
      const program = getAcademicProgram(item.programCode);
      if (!program || program.departmentCode !== item.departmentCode) { preview.invalid.push({ item, reason: 'registry_mismatch' }); continue; }
      const candidate = new AcademicResource({ ...item, verificationStatus: 'unverified', createdBy: validationActor, updatedBy: validationActor });
      const error = candidate.validateSync();
      if (error) { preview.invalid.push({ item, reason: error.message }); continue; }
      const exactDuplicate = await AcademicResource.findOne({ resourceType: item.resourceType, resourceKind: item.resourceKind, scope: item.scope, programCode: item.programCode, url: item.url }).select('_id verificationStatus').lean();
      if (exactDuplicate) { preview.skips.push({ item, existingId: exactDuplicate._id, verificationStatus: exactDuplicate.verificationStatus }); continue; }
      const applicabilityConflict = await AcademicResource.findOne({ isActive: true, resourceType: item.resourceType, scope: item.scope, programCode: item.programCode, semester: null }).select('_id url verificationStatus').lean();
      if (applicabilityConflict) { preview.conflicts.push({ item, existing: applicabilityConflict }); continue; }
      preview.inserts.push(item);
    }
    const batch = `academic-curation-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`;
    let inserted = [];
    if (execute && preview.invalid.length === 0 && preview.conflicts.length === 0 && preview.inserts.length) {
      inserted = await AcademicResource.insertMany(preview.inserts.map((item) => ({ ...item, importBatchId: batch, verificationStatus: 'unverified', createdBy: actor._id, updatedBy: actor._id, history: [{ actor: actor._id, action: 'catalogue_imported_unverified', changedFields: Object.keys(item) }] })), { ordered: true });
    }
    console.log(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', database, batch: execute ? batch : null, counts: { inserts: preview.inserts.length, skips: preview.skips.length, conflicts: preview.conflicts.length, invalid: preview.invalid.length, inserted: inserted.length }, preview }, null, 2));
    if (preview.invalid.length || preview.conflicts.length) process.exitCode = 2;
  }
} finally {
  await mongoose.disconnect();
}
