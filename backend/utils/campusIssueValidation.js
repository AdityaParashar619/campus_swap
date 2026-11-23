import mongoose from 'mongoose';
import { ISSUE_CATEGORIES, ISSUE_LIMITS, ISSUE_NOTE_MIN_LENGTH, ISSUE_STATUSES } from '../models/CampusIssue.js';
import { BadRequest, Conflict } from './AppError.js';
import { requireFields } from './campusLocationValidation.js';
import { escapeSearch, parseNoticePagination } from './noticeValidation.js';

const createFields = new Set(['title', 'description', 'category', 'locationDescription', 'campusLocation']);
const reviewFields = new Set(['status', 'adminResponse', 'resolutionNote']);
const listFields = new Set(['search', 'category', 'status', 'page', 'limit']);
const transitions = {
  submitted: new Set(['under_review', 'closed']),
  under_review: new Set(['under_review', 'resolved', 'closed']),
  resolved: new Set(),
  closed: new Set()
};

export function issueId(value, field = 'Campus issue ID') {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) throw new BadRequest(`${field} is invalid`);
  return value;
}

function readText(body, field, required = false) {
  if (!required && !Object.hasOwn(body, field)) return undefined;
  const input = body[field];
  if (typeof input !== 'string') throw new BadRequest(`${field} must be text`);
  const value = input.trim();
  if (required && !value) throw new BadRequest(`${field} is required`);
  if (value.length > ISSUE_LIMITS[field]) throw new BadRequest(`${field} must be at most ${ISSUE_LIMITS[field]} characters`);
  return value;
}

export function normalizeIssue(body) {
  requireFields(body, createFields);
  const title = readText(body, 'title', true);
  const description = readText(body, 'description', true);
  if (!ISSUE_CATEGORIES.includes(body.category)) throw new BadRequest('Invalid campus issue category');
  return {
    title, description, category: body.category,
    locationDescription: readText(body, 'locationDescription'),
    campusLocation: body.campusLocation == null ? null : issueId(body.campusLocation, 'campusLocation')
  };
}

export function parseIssueList(query, student = false, now = new Date()) {
  requireFields(query, student ? new Set([...listFields, 'view']) : listFields);
  if (Object.values(query).some((value) => typeof value !== 'string')) throw new BadRequest('Each query field must be a single text value');
  const filter = {};
  if (query.category !== undefined) {
    if (!ISSUE_CATEGORIES.includes(query.category)) throw new BadRequest('Invalid campus issue category');
    filter.category = query.category;
  }
  if (query.status !== undefined) {
    if (!ISSUE_STATUSES.includes(query.status)) throw new BadRequest('Invalid campus issue status');
    filter.status = query.status;
  }
  if ((query.search?.length ?? 0) > 100) throw new BadRequest('search must be at most 100 characters');
  if (query.search?.trim()) {
    const pattern = new RegExp(escapeSearch(query.search.trim()), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }
  if (student) {
    const view = query.view ?? 'recent';
    if (!['recent', 'history'].includes(view)) throw new BadRequest('Invalid Campus Issues view');
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const terminal = [['resolved', 'resolvedAt'], ['closed', 'closedAt']];
    const old = terminal.map(([status, field]) => ({ status, [field]: { $lte: cutoff } }));
    // Missing or invalid legacy timestamps remain in Active / Recent.
    filter.$and = [view === 'history' ? { $or: old } : { $nor: old }];
  }
  return { filter, ...parseNoticePagination(query) };
}

export function normalizeIssueReview(body, currentStatus) {
  requireFields(body, reviewFields);
  const { status } = body;
  if (!ISSUE_STATUSES.includes(status)) throw new BadRequest('Invalid campus issue status');
  if (!transitions[currentStatus].has(status)) throw new Conflict('This campus issue status transition is not allowed');
  const adminResponse = readText(body, 'adminResponse');
  const resolutionNote = readText(body, 'resolutionNote');
  if (status === currentStatus && !adminResponse) throw new BadRequest('Enter a response to update a report under review');
  if (status === 'resolved' || status === 'closed') {
    if (!resolutionNote || resolutionNote.length < ISSUE_NOTE_MIN_LENGTH) {
      throw new BadRequest(`Enter a resolution or closure note of at least ${ISSUE_NOTE_MIN_LENGTH} characters`);
    }
  } else if (resolutionNote !== undefined) {
    throw new BadRequest('A resolution note is accepted only when resolving or closing an issue');
  }
  return { status, adminResponse, resolutionNote };
}
