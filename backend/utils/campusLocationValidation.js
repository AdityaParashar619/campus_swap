import { BadRequest } from './AppError.js';
import { escapeSearch, parseNoticePagination } from './noticeValidation.js';
import {
  COORDINATE_LIMITS, LOCATION_CATEGORIES, LOCATION_STATUSES, LOCATION_TEXT_LIMITS,
  isCoordinate, isLocationUrl
} from '../models/CampusLocation.js';

const editable = new Set([...Object.keys(LOCATION_TEXT_LIMITS), ...Object.keys(COORDINATE_LIMITS), 'category', 'buildingCode', 'aliases']);
const readText = (value, field, max) => {
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new BadRequest(`${field} must be text of at most ${max} characters`);
  }
  return value.trim();
};

export function requireFields(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new BadRequest('A JSON object is required');
  const unknown = Object.keys(object).filter((field) => !allowed.has(field));
  if (unknown.length) throw new BadRequest(`Unexpected fields: ${unknown.join(', ')}`);
}

export function normalizeLocation(body, partial = false) {
  requireFields(body, editable);
  if (partial && !Object.keys(body).length) throw new BadRequest('At least one editable field is required');
  const data = {};
  for (const [field, limit] of Object.entries(LOCATION_TEXT_LIMITS)) {
    if (!Object.hasOwn(body, field)) continue;
    const value = body[field] === null && field !== 'name' ? '' : readText(body[field], field, limit);
    if (field.endsWith('Url') && value && !isLocationUrl(value)) throw new BadRequest(`${field} must be a safe HTTPS URL`);
    data[field] = value;
  }
  if ((!partial || Object.hasOwn(body, 'name')) && !data.name) throw new BadRequest('name is required');
  if (!partial || Object.hasOwn(body, 'category')) {
    if (!LOCATION_CATEGORIES.includes(body.category)) throw new BadRequest('Invalid location category');
    data.category = body.category;
  }
  for (const [field, limit] of Object.entries(COORDINATE_LIMITS)) {
    if (!Object.hasOwn(body, field)) continue;
    if (body[field] !== null && !isCoordinate(body[field], limit)) {
      throw new BadRequest(`${field} must be a finite JSON number between -${limit} and ${limit}, or null`);
    }
    data[field] = body[field];
  }
  if (Object.hasOwn(body, 'buildingCode')) {
    const code = body.buildingCode === null ? '' : readText(body.buildingCode, 'buildingCode', 24).toUpperCase();
    if (code && !/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) throw new BadRequest('Invalid building code');
    data.buildingCode = code || undefined;
  }
  if (Object.hasOwn(body, 'aliases')) {
    if (!Array.isArray(body.aliases) || body.aliases.length > 10) throw new BadRequest('aliases must be an array of at most 10 names');
    const aliases = body.aliases.map((alias) => readText(alias, 'alias', 120));
    if (aliases.some((alias) => !alias)) throw new BadRequest('Aliases cannot be blank');
    data.aliases = [...new Set(aliases)];
  }
  return data;
}

export function readCoordinateReview(body) {
  requireFields(body, new Set(['coordinateSource', 'latitude', 'longitude']));
  for (const [field, limit] of Object.entries(COORDINATE_LIMITS)) {
    if (!isCoordinate(body[field], limit)) throw new BadRequest(`Review requires a valid ${field}`);
  }
  const source = readText(body.coordinateSource, 'coordinateSource', 500);
  if (!source) throw new BadRequest('Coordinate verification requires a source');
  return { source, latitude: body.latitude, longitude: body.longitude };
}

export function parseLocationList(query, admin = false) {
  const allowed = new Set(['page', 'limit', 'category', 'search']);
  if (admin) allowed.add('status');
  requireFields(query, allowed);
  for (const value of Object.values(query)) {
    if (typeof value !== 'string') throw new BadRequest('Each query parameter must have a single text value');
  }
  const filter = {};
  if (query.category !== undefined) {
    if (!LOCATION_CATEGORIES.includes(query.category)) throw new BadRequest('Invalid location category');
    filter.category = query.category;
  }
  if (query.status !== undefined) {
    if (!LOCATION_STATUSES.includes(query.status)) throw new BadRequest('Invalid location status');
    filter.status = query.status;
  }
  if ((query.search?.length ?? 0) > 100) throw new BadRequest('search must be at most 100 characters');
  if (query.search?.trim()) {
    const pattern = new RegExp(escapeSearch(query.search.trim()), 'i');
    filter.$or = ['name', 'buildingCode', 'aliases'].map((field) => ({ [field]: pattern }));
  }
  return { filter, ...parseNoticePagination(query) };
}
