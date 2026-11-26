import { env } from '../config/env.js';
import AcademicResource from '../models/AcademicResource.js';
import { resolveAcademicProgram } from '../utils/academicPrograms.js';

const RESOURCE_TYPES = ['syllabus', 'timetable', 'scheme', 'faculty', 'department_overview', 'academic_calendar'];

const fallbackFor = (resourceType, indexedFallback) => indexedFallback ? {
  status: 'browsing_fallback', label: indexedFallback.title, url: indexedFallback.url,
  resourceType, isExactDocument: false, sourceUrl: indexedFallback.sourceUrl || indexedFallback.url,
  lastVerifiedAt: indexedFallback.lastVerifiedAt
} : { status: 'not_available', resourceType, isExactDocument: false };

const applicability = (resource, identity) => {
  const sessionRequired = Boolean(resource.academicSession);
  const batchRequired = Boolean(resource.admissionBatch);
  const exactAcademicDocument = resource.resourceKind !== 'official_index' && ['syllabus', 'timetable'].includes(resource.resourceType);
  const applicabilityMissing = exactAcademicDocument && !sessionRequired && !batchRequired;
  const sessionMatches = !sessionRequired || (identity.academicSession && resource.academicSession === identity.academicSession);
  const batchMatches = !batchRequired || (identity.admissionBatch && resource.admissionBatch === identity.admissionBatch);
  return {
    confirmed: Boolean(!applicabilityMissing && sessionMatches && batchMatches),
    mismatched: Boolean((sessionRequired && identity.academicSession && !sessionMatches) || (batchRequired && identity.admissionBatch && !batchMatches)),
    requiresProfileData: Boolean(applicabilityMissing || (sessionRequired && !identity.academicSession) || (batchRequired && !identity.admissionBatch))
  };
};

const classify = (resource, identity) => {
  if (resource.resourceKind === 'official_index') return 'browsing_fallback';
  if (resource.applicabilityMode === 'reference_only') return resource.verificationStatus === 'verified' ? 'official_reference' : 'published_reference';
  if (['syllabus', 'timetable'].includes(resource.resourceType) && resource.scope === 'program' && resource.semester) {
    if (resource.verificationStatus === 'verified' && applicability(resource, identity).confirmed) return 'exact_verified_match';
    return 'published_reference';
  }
  if (resource.scope === 'college') return 'college_resource';
  if (resource.scope === 'department') return 'department_resource';
  return 'program_resource';
};

const serialize = (resource, identity) => {
  const matchStatus = classify(resource, identity);
  const applicabilityConfirmed = !['session_or_batch_unconfirmed', 'official_reference', 'published_reference'].includes(matchStatus);
  const referenceOnly = ['official_reference', 'published_reference'].includes(matchStatus);
  return {
    id: resource._id.toString(), title: resource.title, description: resource.description,
    resourceType: resource.resourceType, scope: resource.scope,
    departmentCode: resource.departmentCode, programCode: resource.programCode,
    semester: resource.semester, academicSession: resource.academicSession,
    admissionBatch: resource.admissionBatch, sourceType: resource.sourceType, resourceKind: resource.resourceKind || 'exact_document',
    applicabilityMode: resource.applicabilityMode || 'exact_applicable', publicationStatus: resource.publicationStatus || 'draft', referenceOnly,
    applicabilityEvidence: resource.applicabilityEvidence || '', uncertainty: resource.uncertainty || '', checkedAt: resource.checkedAt,
    lastVerifiedAt: resource.lastVerifiedAt, matchStatus, applicabilityConfirmed,
    ...(applicabilityConfirmed || referenceOnly ? { url: resource.url, sourceUrl: resource.sourceUrl || null } : { sourceUrl: resource.sourceUrl || null })
  };
};

export const buildPersonalizedAcademicResources = async (user, { ResourceModel = AcademicResource } = {}) => {
  const program = resolveAcademicProgram(user?.branch);
  const semester = String(user?.semester || '').trim();
  if (!program || !/^[1-8]$/.test(semester)) {
    return { supported: false, reason: !program ? 'unsupported_branch' : 'invalid_semester', resources: [], availability: {} };
  }

  const identity = {
    registrationBranch: program.registrationCode,
    programCode: program.programCode,
    programName: program.displayName,
    departmentCode: program.departmentCode,
    semester,
    academicSession: typeof user?.academicSession === 'string' && /^\d{4}-\d{2}$/.test(user.academicSession) ? user.academicSession : null,
    admissionBatch: typeof user?.admissionBatch === 'string' && /^\d{4}$/.test(user.admissionBatch) ? user.admissionBatch : null
  };

  const records = await ResourceModel.find({
    isActive: true,
    $and: [{ $or: [
      { publicationStatus: 'published', ...(env.nodeEnv === 'production' && !env.facultyDemoMode && { verificationStatus: 'verified' }) },
      { publicationStatus: { $exists: false }, verificationStatus: 'verified' }
    ] }],
    semester: { $in: [semester, null] },
    $or: [
      { scope: 'college', departmentCode: null, programCode: null },
      { scope: 'department', departmentCode: program.departmentCode, programCode: null },
      { scope: 'program', departmentCode: program.departmentCode, programCode: program.programCode }
    ]
  }).sort({ semester: -1, resourceType: 1, title: 1 }).lean();

  const serialized = records.map((resource) => serialize(resource, identity)).sort((left, right) => {
    const rank = { exact_verified_match: 0, published_reference: 1, official_reference: 2 };
    return (rank[left.matchStatus] ?? 3) - (rank[right.matchStatus] ?? 3);
  });
  const resources = serialized.filter((resource) => resource.matchStatus !== 'browsing_fallback');
  const availability = Object.fromEntries(RESOURCE_TYPES.map((resourceType) => {
    const exact = resources.find((resource) => resource.resourceType === resourceType && resource.matchStatus === 'exact_verified_match');
    const indexedFallback = serialized.find((resource) => resource.resourceType === resourceType && resource.matchStatus === 'browsing_fallback');
    return [resourceType, exact ? { status: 'exact_verified_match', resource: exact } : fallbackFor(resourceType, indexedFallback)];
  }));

  return {
    supported: true,
    identity,
    resources,
    availability,
    limitations: ['Academic session and admission batch are not stored on the current user profile. Session- or batch-specific documents are never classified as exact matches.']
  };
};
