export const ACADEMIC_CATEGORIES = Object.freeze([
  { type: 'syllabus', label: 'Syllabus', priority: true },
  { type: 'timetable', label: 'Timetable', priority: true },
  { type: 'scheme', label: 'Academic schemes' },
  { type: 'faculty', label: 'Faculty directory' },
  { type: 'department_overview', label: 'Department overview' },
  { type: 'academic_calendar', label: 'Academic calendar' }
]);

const allowedStatuses = new Set(['exact_verified_match', 'published_reference', 'program_resource', 'department_resource', 'college_resource', 'official_reference', 'session_or_batch_unconfirmed']);
const safeResource = (resource) => resource && typeof resource === 'object' && typeof resource.title === 'string' && typeof resource.resourceType === 'string'
  ? { ...resource, matchStatus: allowedStatuses.has(resource.matchStatus) ? resource.matchStatus : 'session_or_batch_unconfirmed' }
  : null;

export const normalizeAcademicResponse = (payload) => {
  const data = payload && typeof payload === 'object' ? payload : {};
  const identity = data.identity && typeof data.identity === 'object' ? data.identity : null;
  const resources = Array.isArray(data.resources) ? data.resources.map(safeResource).filter(Boolean) : [];
  const availability = data.availability && typeof data.availability === 'object' ? data.availability : {};
  return { supported: data.supported === true, reason: data.reason || '', identity, resources, availability };
};

export const resourcesByCategory = (normalized) => Object.fromEntries(ACADEMIC_CATEGORIES.map(({ type }) => [type, normalized.resources.filter((resource) => resource.resourceType === type)]));

export const availabilityFor = (normalized, type) => {
  const value = normalized.availability[type];
  if (value?.status === 'exact_verified_match' && value.resource) return value;
  if (value?.status === 'browsing_fallback' && typeof value.url === 'string') return value;
  return { status: 'not_available', resourceType: type, isExactDocument: false };
};

export const buildAcademicResourcePayload = (form, publicationStatus) => Object.fromEntries(
  Object.entries({ ...form, publicationStatus }).map(([key, value]) => [key, value || null])
);

export const resourceStatusLabel = (status) => ({
  exact_verified_match: 'Exact verified match', program_resource: 'Program resource', department_resource: 'Department resource',
  college_resource: 'College-wide resource', published_reference: 'Published resource', official_reference: 'Reference only — applicability unconfirmed', session_or_batch_unconfirmed: 'Session or batch unconfirmed'
}[status] || 'Applicability unconfirmed');
