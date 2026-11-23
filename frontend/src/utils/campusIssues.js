export const ISSUE_CATEGORIES = Object.freeze({
  infrastructure: 'Infrastructure', cleanliness: 'Cleanliness', water: 'Water',
  electricity: 'Electricity', internet: 'Internet', library: 'Library', hostel: 'Hostel',
  accessibility: 'Accessibility', other: 'Other'
});

export const ISSUE_STATUSES = Object.freeze({
  submitted: 'Submitted', under_review: 'Under Review', resolved: 'Resolved', closed: 'Closed'
});

export const ISSUE_LIMITS = Object.freeze({ title: 120, description: 3000, locationDescription: 300 });
export const isIssueObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
export const ISSUE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ISSUE_PHOTO_LIMIT = 3;
export const ISSUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function validateIssuePhotos(files, selectedCount = 0) {
  if (files.length + selectedCount > ISSUE_PHOTO_LIMIT) throw new Error('Select at most 3 photos.');
  for (const file of files) {
    if (!ISSUE_PHOTO_TYPES.includes(file.type)) throw new Error('Only JPEG, PNG, and WebP photos are supported.');
    if (file.size < 1 || file.size > ISSUE_PHOTO_MAX_BYTES) throw new Error('Each photo must be nonempty and 5 MB or smaller.');
  }
}

export function buildIssuePayload(form) {
  const title = form.title.trim();
  const description = form.description.trim();
  const locationDescription = form.locationDescription.trim();
  if (!title) throw new Error('Enter a title.');
  if (!Object.hasOwn(ISSUE_CATEGORIES, form.category)) throw new Error('Choose a category.');
  if (!description) throw new Error('Enter a description.');
  for (const [field, label, value] of [
    ['title', 'Title', title], ['description', 'Description', description],
    ['locationDescription', 'Location description', locationDescription]
  ]) {
    if (value.length > ISSUE_LIMITS[field]) throw new Error(`${label} must be at most ${ISSUE_LIMITS[field]} characters.`);
  }
  if (form.campusLocation && !isIssueObjectId(form.campusLocation)) throw new Error('Choose an available campus location or remove the selection.');
  return {
    title, category: form.category, description,
    ...(locationDescription && { locationDescription }),
    ...(form.campusLocation && { campusLocation: form.campusLocation })
  };
}

export function normalizeIssueLocation(value) {
  return isIssueObjectId(value?.id) && typeof value.name === 'string' && value.name.trim()
    ? { id: value.id, name: value.name } : null;
}

const asText = (value) => typeof value === 'string' ? value : '';
const asDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;

export function normalizeIssue(value) {
  if (!isIssueObjectId(value?.id) || typeof value.title !== 'string' || typeof value.description !== 'string'
    || !Object.hasOwn(ISSUE_CATEGORIES, value.category) || !Object.hasOwn(ISSUE_STATUSES, value.status)) return null;
  return {
    id: value.id, title: value.title, description: value.description, category: value.category, status: value.status,
    locationDescription: asText(value.locationDescription), campusLocation: normalizeIssueLocation(value.campusLocation),
    adminResponse: asText(value.adminResponse), resolutionNote: asText(value.resolutionNote),
    createdAt: asDate(value.createdAt), reviewedAt: asDate(value.reviewedAt),
    resolvedAt: asDate(value.resolvedAt), closedAt: asDate(value.closedAt),
    ...(Array.isArray(value.evidence) && {
      evidence: value.evidence.filter((photo) => isIssueObjectId(photo?.id)).slice(0, ISSUE_PHOTO_LIMIT)
        .map((photo) => ({ id: photo.id }))
    })
  };
}

export function readIssuePage(payload, normalize, expectedPage) {
  const { pagination } = payload ?? {};
  if (!payload?.success || !Array.isArray(payload.data) || pagination?.page !== expectedPage
    || !Number.isInteger(pagination.totalPages) || pagination.totalPages < 0) {
    throw new Error('Invalid page response');
  }
  const data = payload.data.map(normalize);
  if (data.some((record) => !record)) throw new Error('Invalid record in page');
  return { data, totalPages: Math.min(pagination.totalPages, 10000) };
}

export function issueSubmitError(error) {
  const { status, data } = error?.response ?? {};
  if (status === 400 && typeof data?.message === 'string' && data.message) return data.message;
  if ((status === 409 || status === 503) && typeof data?.message === 'string' && data.message) return data.message;
  if (status === 413) return 'The upload is too large. Select smaller photos.';
  if (status === 429) return 'Too many submissions. Wait a few minutes and try again. Your report is still in the form.';
  if (status === 401 || status === 403) return 'Your session cannot submit this report. Sign in with your student account.';
  return 'We could not confirm submission. Check My Reports before trying again. Your report is still in the form.';
}
