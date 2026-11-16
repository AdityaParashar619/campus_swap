import { BadRequest } from './AppError.js';

export const LISTING_CATEGORIES = Object.freeze([
  'General', 'Books', 'Textbooks', 'Electronics', 'Notes', 'Furniture', 'Hostel', 'Services', 'Other'
]);
export const LISTING_CONDITIONS = Object.freeze(['new', 'like_new', 'good', 'fair']);
export const LISTING_AVAILABILITIES = Object.freeze(['available', 'sold', 'swapped']);
export const MAX_LISTING_PRICE = 10_000_000;

const limits = Object.freeze({
  title: 120,
  description: 5000,
  location: 120,
  tag: 40,
  tags: 10,
  image: 2048,
  images: 5
});

const categoryAliases = new Map(LISTING_CATEGORIES.map((category) => [category.toLowerCase(), category]));

const requirePlainObject = (value) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequest('Listing data must be an object.');
  }
};

const normalizeText = (value, field, { required = false, max }) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequest(`${field} must be text.`);
  const normalized = value.trim();
  if (required && !normalized) throw new BadRequest(`${field} is required.`);
  if (normalized.length > max) throw new BadRequest(`${field} must be ${max} characters or fewer.`);
  return normalized;
};

const normalizeStringArray = (value, field, { maxItems, maxLength }) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequest(`${field} must be an array.`);
  if (value.length > maxItems) throw new BadRequest(`${field} can contain at most ${maxItems} items.`);
  return value.map((item) => {
    if (typeof item !== 'string') throw new BadRequest(`${field} must contain only text values.`);
    const normalized = item.trim();
    if (!normalized || normalized.length > maxLength) {
      throw new BadRequest(`Each ${field} value must be between 1 and ${maxLength} characters.`);
    }
    return normalized;
  });
};

const normalizeCategory = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequest('Category must be text.');
  const category = categoryAliases.get(value.trim().toLowerCase());
  if (!category) throw new BadRequest(`Category must be one of: ${LISTING_CATEGORIES.join(', ')}.`);
  return category;
};

const normalizePrice = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequest('Price must be a valid number.');
  if (value < 0 || value > MAX_LISTING_PRICE) {
    throw new BadRequest(`Price must be between 0 and ${MAX_LISTING_PRICE}.`);
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const normalizeEnum = (value, field, values) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new BadRequest(`${field} must be one of: ${values.join(', ')}.`);
  }
  return value;
};

const normalizeBoolean = (value, field) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new BadRequest(`${field} must be true or false.`);
  return value;
};

export const validateListingPayload = (payload, { partial = false } = {}) => {
  requirePlainObject(payload);
  const allowedFields = new Set([
    'title', 'description', 'category', 'condition', 'images', 'availability',
    'tags', 'price', 'isSwapAllowed', 'location'
  ]);
  const fields = Object.keys(payload);
  const unsupported = fields.filter((field) => !allowedFields.has(field));
  if (unsupported.length) throw new BadRequest(`Unsupported listing fields: ${unsupported.join(', ')}.`);
  if (partial && fields.length === 0) throw new BadRequest('At least one listing field is required.');

  const normalized = {};
  const values = {
    title: normalizeText(payload.title, 'Title', { required: true, max: limits.title }),
    description: normalizeText(payload.description, 'Description', { max: limits.description }),
    category: normalizeCategory(payload.category),
    condition: normalizeEnum(payload.condition === 'used' ? 'good' : payload.condition, 'Condition', LISTING_CONDITIONS),
    images: normalizeStringArray(payload.images, 'Images', { maxItems: limits.images, maxLength: limits.image }),
    availability: normalizeEnum(payload.availability, 'Availability', LISTING_AVAILABILITIES),
    tags: normalizeStringArray(payload.tags, 'Tags', { maxItems: limits.tags, maxLength: limits.tag }),
    price: normalizePrice(payload.price),
    isSwapAllowed: normalizeBoolean(payload.isSwapAllowed, 'isSwapAllowed'),
    location: normalizeText(payload.location, 'Location', { max: limits.location })
  };

  for (const [field, value] of Object.entries(values)) {
    if (value !== undefined) normalized[field] = value;
  }
  if (!partial && !normalized.title) throw new BadRequest('Title is required.');
  return normalized;
};

export const assertAvailabilityTransition = (current, next) => {
  if (next === undefined || next === current) return;
  if (current === 'available' && ['sold', 'swapped'].includes(next)) return;
  throw new BadRequest(`Listing status cannot change from ${current} to ${next}.`);
};

