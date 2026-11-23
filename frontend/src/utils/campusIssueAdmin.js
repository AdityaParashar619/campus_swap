import { normalizeIssue } from './campusIssues.js';

const actions = {
  submitted: { under_review: 'Start review', closed: 'Close report' },
  under_review: { under_review: 'Save response', resolved: 'Resolve report', closed: 'Close report' },
  resolved: {},
  closed: {}
};

export const issueReviewActions = (status) => actions[status] ?? {};
export const REVIEW_TEXT_LIMIT = 2000;
const minNoteLength = 10;

export function normalizeAdminIssue(input) {
  const issue = normalizeIssue(input);
  if (!issue || !Number.isSafeInteger(input.version) || input.version < 0) return null;
  return {
    ...issue,
    canDeleteTestReport: input.canDeleteTestReport === true,
    cleanupPending: input.cleanupPending === true,
    version: input.version,
    updatedAt: typeof input.updatedAt === 'string' && Number.isFinite(Date.parse(input.updatedAt)) ? input.updatedAt : null
  };
}

export function buildIssueReview(issue, status, text) {
  if (!Object.hasOwn(issueReviewActions(issue.status), status)) throw new Error('This review action is unavailable.');
  if (!Number.isSafeInteger(issue.version) || issue.version < 0) throw new Error('Reload the report before saving.');
  const value = text.trim();
  if (value.length > REVIEW_TEXT_LIMIT) throw new Error(`Use at most ${REVIEW_TEXT_LIMIT} characters.`);
  const data = { status };
  if (status === 'under_review') {
    if (issue.status === 'under_review' && !value) throw new Error('Enter a response before saving.');
    if (value) data.adminResponse = value;
  } else {
    if (value.length < minNoteLength) {
      throw new Error(status === 'closed'
        ? 'Enter a closure explanation of at least 10 characters.'
        : 'Enter a resolution note of at least 10 characters.');
    }
    data.resolutionNote = value;
  }
  return { data, ifMatch: `"${issue.version}"` };
}
