import mongoose from 'mongoose';
import AcademicResource, { ACADEMIC_RESOURCE_SCOPES, ACADEMIC_RESOURCE_TYPES, ACADEMIC_VERIFICATION_STATUSES } from '../models/AcademicResource.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { academicPrograms, getAcademicProgram } from '../utils/academicPrograms.js';
import { BadRequest, Conflict, NotFound } from '../utils/AppError.js';

const EDITABLE = [
  'title', 'description', 'resourceType', 'resourceKind', 'applicabilityMode', 'publicationStatus',
  'scope', 'departmentCode', 'programCode', 'semester', 'academicSession', 'admissionBatch',
  'url', 'sourceUrl', 'sourceType', 'applicabilityEvidence', 'uncertainty', 'checkedAt'
];
const REVERIFY = new Set(EDITABLE.filter((key) => !['description', 'title', 'publicationStatus'].includes(key)));

const clean = (body, partial = false) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('A JSON object is required');
  const unknown = Object.keys(body).filter((key) => !EDITABLE.includes(key));
  if (unknown.length) throw new BadRequest(`Unexpected fields: ${unknown.join(', ')}`);
  const data = {};
  for (const key of EDITABLE) if (!partial || Object.hasOwn(body, key)) data[key] = body[key] === '' ? null : body[key];
  for (const key of ['title', 'description', 'departmentCode', 'programCode', 'semester', 'academicSession', 'admissionBatch', 'url', 'sourceUrl', 'applicabilityEvidence', 'uncertainty']) {
    if (data[key] == null) continue;
    const limit = ['description', 'applicabilityEvidence'].includes(key) ? 2000 : key === 'uncertainty' ? 1000 : 500;
    if (typeof data[key] !== 'string' || data[key].trim().length > limit) throw new BadRequest(`Invalid ${key}`);
    data[key] = data[key].trim();
  }
  if (data.checkedAt != null) {
    const checkedAt = new Date(data.checkedAt);
    if (Number.isNaN(checkedAt.getTime())) throw new BadRequest('Invalid checkedAt');
    data.checkedAt = checkedAt;
  }
  if (!partial && !data.title) throw new BadRequest('title is required');
  if (data.resourceType && !ACADEMIC_RESOURCE_TYPES.includes(data.resourceType)) throw new BadRequest('Invalid resource type');
  if (data.resourceKind && !['exact_document', 'official_index'].includes(data.resourceKind)) throw new BadRequest('Invalid resource kind');
  if (data.applicabilityMode && !['exact_applicable', 'reference_only'].includes(data.applicabilityMode)) throw new BadRequest('Invalid applicability mode');
  if (data.publicationStatus && !['draft', 'published'].includes(data.publicationStatus)) throw new BadRequest('Invalid publication status');
  if (data.scope && !ACADEMIC_RESOURCE_SCOPES.includes(data.scope)) throw new BadRequest('Invalid scope');
  if (data.semester && !/^[1-8]$/.test(data.semester)) throw new BadRequest('Semester must be 1 through 8');
  if (data.programCode) {
    const program = getAcademicProgram(data.programCode);
    if (!program) throw new BadRequest('Unknown canonical program');
    if (data.departmentCode && data.departmentCode.toUpperCase() !== program.departmentCode) throw new BadRequest('Invalid program and department combination');
    data.programCode = program.programCode;
    data.departmentCode = program.departmentCode;
  }
  return data;
};

const duplicate = async (data, excluded) => {
  const query = {
    isActive: true, resourceType: data.resourceType, scope: data.scope,
    departmentCode: data.departmentCode || null, programCode: data.programCode || null,
    semester: data.semester || null, academicSession: data.academicSession || null,
    admissionBatch: data.admissionBatch || null, url: data.url
  };
  if (excluded) query._id = { $ne: excluded };
  if (await AcademicResource.exists(query)) throw new Conflict('Duplicate active academic resource');
};

export const assertPublishable = (item) => {
  if (item.resourceKind === 'exact_document' && ['syllabus', 'timetable'].includes(item.resourceType)
    && (item.scope !== 'program' || !item.programCode || !item.semester)) {
    throw new BadRequest('Publishing a syllabus or timetable requires a canonical program and semester');
  }
  if (process.env.NODE_ENV === 'production' && item.verificationStatus !== 'verified') {
    throw new BadRequest('Production publication requires independent verification');
  }
};

export const listAcademicResources = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const filter = {};
  for (const key of ['programCode', 'departmentCode', 'resourceType', 'semester', 'verificationStatus', 'publicationStatus']) {
    if (typeof req.query[key] === 'string' && req.query[key].trim()) filter[key] = req.query[key].trim();
  }
  const [items, total] = await Promise.all([
    AcademicResource.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AcademicResource.countDocuments(filter)
  ]);
  res.json({ success: true, data: items, programs: academicPrograms, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const createAcademicResource = asyncHandler(async (req, res) => {
  const data = clean(req.body);
  await duplicate(data);
  const actor = req.user.userId;
  const publicationStatus = data.publicationStatus || 'draft';
  const candidate = new AcademicResource({ ...data, publicationStatus, publishedAt: publicationStatus === 'published' ? new Date() : null });
  if (publicationStatus === 'published') assertPublishable(candidate);
  const item = await AcademicResource.create({
    ...data, publicationStatus, publishedAt: publicationStatus === 'published' ? new Date() : null,
    verificationStatus: 'unverified', lastVerifiedAt: null, verifiedBy: null, isActive: true,
    createdBy: actor, updatedBy: actor,
    history: [{ actor, action: publicationStatus === 'published' ? 'created_and_published' : 'created_draft', changedFields: Object.keys(data) }]
  });
  res.status(201).json({ success: true, data: item });
});

export const updateAcademicResource = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequest('Invalid resource ID');
  const item = await AcademicResource.findById(req.params.id);
  if (!item) throw new NotFound('Academic resource not found');
  const changes = clean(req.body, true);
  const changed = Object.keys(changes).filter((key) => String(item[key] ?? '') !== String(changes[key] ?? ''));
  Object.assign(item, changes);
  item.updatedBy = req.user.userId;
  if (changed.some((key) => REVERIFY.has(key))) {
    item.verificationStatus = 'unverified';
    item.lastVerifiedAt = null;
    item.verifiedBy = null;
  }
  if (item.publicationStatus === 'published') {
    assertPublishable(item);
    item.publishedAt = item.publishedAt || new Date();
  } else {
    item.publishedAt = null;
  }
  item.history.push({ actor: req.user.userId, action: item.publicationStatus === 'published' ? 'updated_and_published' : 'updated_draft', changedFields: changed });
  await duplicate(item.toObject(), item._id);
  await item.save();
  res.json({ success: true, data: item });
});

export const setAcademicResourceStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequest('Invalid resource ID');
  const keys = Object.keys(req.body || {});
  if (!keys.length || keys.some((key) => !['verificationStatus', 'publicationStatus', 'isActive'].includes(key))) {
    throw new BadRequest('Provide only verificationStatus, publicationStatus, and/or isActive');
  }
  const item = await AcademicResource.findById(req.params.id);
  if (!item) throw new NotFound('Academic resource not found');
  const changed = [];
  if (Object.hasOwn(req.body, 'verificationStatus')) {
    if (!ACADEMIC_VERIFICATION_STATUSES.includes(req.body.verificationStatus)) throw new BadRequest('Invalid verification status');
    if (req.body.verificationStatus === 'verified' && item.applicabilityMode === 'reference_only'
      && (item.resourceKind !== 'exact_document' || item.scope !== 'program' || !item.programCode || !item.semester
        || !item.sourceUrl || !item.checkedAt || !item.applicabilityEvidence || !item.uncertainty)) {
      throw new BadRequest('Reference verification requires an exact program and semester, official source, review date, evidence, and uncertainty');
    }
    if (req.body.verificationStatus === 'verified' && item.applicabilityMode !== 'reference_only'
      && item.resourceKind !== 'official_index' && ['syllabus', 'timetable'].includes(item.resourceType)
      && item.scope === 'program' && (!item.programCode || !item.semester || (!item.academicSession && !item.admissionBatch))) {
      throw new BadRequest('Exact syllabus/timetable verification requires program, semester, and session or admission batch');
    }
    item.verificationStatus = req.body.verificationStatus;
    item.lastVerifiedAt = req.body.verificationStatus === 'verified' ? new Date() : null;
    item.verifiedBy = req.body.verificationStatus === 'verified' ? req.user.userId : null;
    changed.push('verificationStatus');
  }
  if (Object.hasOwn(req.body, 'publicationStatus')) {
    if (!['draft', 'published'].includes(req.body.publicationStatus)) throw new BadRequest('Invalid publication status');
    if (req.body.publicationStatus === 'published') {
      assertPublishable(item);
      item.isActive = true;
      item.retiredAt = null;
      item.publishedAt = item.publishedAt || new Date();
    } else {
      item.publishedAt = null;
    }
    item.publicationStatus = req.body.publicationStatus;
    changed.push('publicationStatus');
  }
  if (Object.hasOwn(req.body, 'isActive')) {
    if (typeof req.body.isActive !== 'boolean') throw new BadRequest('isActive must be boolean');
    item.isActive = req.body.isActive;
    item.retiredAt = req.body.isActive ? null : new Date();
    if (!req.body.isActive) {
      item.publicationStatus = 'draft';
      item.publishedAt = null;
    }
    changed.push('isActive');
  }
  item.updatedBy = req.user.userId;
  const action = !item.isActive ? 'retired' : item.publicationStatus === 'published' ? 'published' : 'status_changed';
  item.history.push({ actor: req.user.userId, action, changedFields: changed });
  await item.save();
  res.json({ success: true, data: item });
});
