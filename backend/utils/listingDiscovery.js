import { BadRequest } from './AppError.js';
import {
  LISTING_AVAILABILITIES,
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  MAX_LISTING_PRICE
} from './listingValidation.js';

const ALLOWED_QUERY_FIELDS = new Set([
  'search', 'category', 'condition', 'minPrice', 'maxPrice', 'availability', 'sort', 'page', 'limit'
]);
const SORTS = Object.freeze({
  newest: { createdAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 }
});
const MAX_SEARCH_LENGTH = 100;
const MAX_SKIP = 1_000_000;

const scalar = (query, field) => {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequest(`${field} must be a single text value.`);
  return value.trim();
};

const positiveInteger = (value, field, fallback, maximum) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequest(`${field} must be a positive integer.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new BadRequest(`${field} must be between 1 and ${maximum}.`);
  }
  return number;
};

const price = (value, field) => {
  if (value === undefined || value === '') return undefined;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new BadRequest(`${field} must be a valid non-negative price with at most two decimal places.`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number > MAX_LISTING_PRICE) {
    throw new BadRequest(`${field} must be between 0 and ${MAX_LISTING_PRICE}.`);
  }
  return number;
};

const enumValue = (value, field, values) => {
  if (value === undefined || value === '') return undefined;
  if (!values.includes(value)) throw new BadRequest(`${field} must be one of: ${values.join(', ')}.`);
  return value;
};

export const parseListingDiscoveryQuery = (query = {}) => {
  if (!query || Array.isArray(query) || typeof query !== 'object') throw new BadRequest('Query parameters must be an object.');
  const unsupported = Object.keys(query).filter((field) => !ALLOWED_QUERY_FIELDS.has(field));
  if (unsupported.length) throw new BadRequest(`Unsupported listing query fields: ${unsupported.join(', ')}.`);

  const search = scalar(query, 'search');
  if (search?.length > MAX_SEARCH_LENGTH) throw new BadRequest(`search must be ${MAX_SEARCH_LENGTH} characters or fewer.`);
  const categoryInput = scalar(query, 'category');
  const category = categoryInput
    ? LISTING_CATEGORIES.find((item) => item.toLowerCase() === categoryInput.toLowerCase())
    : undefined;
  if (categoryInput && !category) throw new BadRequest(`category must be one of: ${LISTING_CATEGORIES.join(', ')}.`);
  const condition = enumValue(scalar(query, 'condition'), 'condition', LISTING_CONDITIONS);
  const availability = enumValue(scalar(query, 'availability'), 'availability', LISTING_AVAILABILITIES);
  const sortName = enumValue(scalar(query, 'sort'), 'sort', Object.keys(SORTS)) || 'newest';
  const minPrice = price(scalar(query, 'minPrice'), 'minPrice');
  const maxPrice = price(scalar(query, 'maxPrice'), 'maxPrice');
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new BadRequest('minPrice cannot be greater than maxPrice.');
  }
  const page = positiveInteger(scalar(query, 'page'), 'page', 1, 1_000_000);
  const limit = positiveInteger(scalar(query, 'limit'), 'limit', 12, 50);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_SKIP) throw new BadRequest('Requested page is too far from the beginning of the result set.');

  const filter = { isHidden: { $ne: true } };
  if (search) filter.$text = { $search: search };
  // Canonical and lowercase values retain compatibility with listings created before category normalization.
  if (category) filter.category = { $in: [category, category.toLowerCase()] };
  if (condition) filter.condition = condition;
  if (availability) filter.availability = availability;
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  return { filter, page, limit, skip, sort: SORTS[sortName], sortName };
};

