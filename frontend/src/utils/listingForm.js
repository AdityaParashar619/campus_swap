export const LISTING_CATEGORIES = [
  'General', 'Books', 'Textbooks', 'Electronics', 'Notes', 'Furniture', 'Hostel', 'Services', 'Other'
];

export const createListingSubmissionLock = () => {
  let locked = false;
  return { tryLock() { if (locked) return false; locked = true; return true; }, release() { locked = false; } };
};

export const validateListingForm = (formData) => {
  const errors = {};
  const title = formData.title.trim();
  const description = formData.description.trim();
  const location = formData.location.trim();
  const price = formData.price === '' ? 0 : Number(formData.price);
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 120) errors.title = 'Title must be 120 characters or fewer.';
  if (description.length > 5000) errors.description = 'Description must be 5000 characters or fewer.';
  if (!LISTING_CATEGORIES.includes(formData.category)) errors.category = 'Choose a valid category.';
  if (!['new', 'like_new', 'good', 'fair'].includes(formData.condition)) errors.condition = 'Choose a valid condition.';
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) errors.price = 'Price must be between INR 0 and INR 10,000,000.';
  if (location.length > 120) errors.location = 'Location must be 120 characters or fewer.';
  return { errors, values: { title, description, category: formData.category, condition: formData.condition, price, location } };
};

export const mergeListingUpdate = (current, updated) => ({ ...current, ...updated, user: updated.user || current.user });

export const validateSelectedImages = (files, currentCount, { maxCount = 5, maxBytes = 5 * 1024 * 1024 } = {}) => {
  const accepted = [];
  const errors = [];
  if (currentCount + files.length > maxCount) errors.push(`You can add up to ${maxCount} images.`);
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) errors.push(`${file.name} must be JPEG, PNG, or WebP.`);
    else if (!file.size || file.size > maxBytes) errors.push(`${file.name} must be between 1 byte and 5 MB.`);
    else accepted.push(file);
  }
  return { accepted: errors.length ? [] : accepted, errors };
};

export const getMarketplaceImageUrl = (url) => typeof url === 'string' && url.includes('/image/upload/') && /res\.cloudinary\.com/i.test(url)
  ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_fill,w_600,h_400/')
  : url;

export const DEFAULT_DISCOVERY_FILTERS = Object.freeze({
  search: '', category: '', condition: '', minPrice: '', maxPrice: '', availability: '', sort: 'newest'
});

export const buildListingQuery = (filters, page = 1, limit = 12) => {
  const params = { page, limit, sort: filters.sort || 'newest' };
  for (const field of ['search', 'category', 'condition', 'minPrice', 'maxPrice', 'availability']) {
    const value = typeof filters[field] === 'string' ? filters[field].trim() : filters[field];
    if (value !== '' && value !== undefined && value !== null) params[field] = value;
  }
  return params;
};

export const validateDiscoveryPrices = ({ minPrice, maxPrice }) => {
  const errors = {};
  const parse = (value, field) => {
    if (value === '') return undefined;
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value) || Number(value) > 10_000_000) {
      errors[field] = 'Enter a price from 0 to 10,000,000 with up to two decimals.';
      return undefined;
    }
    return Number(value);
  };
  const min = parse(minPrice, 'minPrice');
  const max = parse(maxPrice, 'maxPrice');
  if (min !== undefined && max !== undefined && min > max) errors.maxPrice = 'Maximum price must be at least the minimum price.';
  return errors;
};

export const scheduleDiscoverySearch = (callback, delay = 300, timers = globalThis) => {
  const id = timers.setTimeout(callback, delay);
  return () => timers.clearTimeout(id);
};

export const createLatestRequestGuard = () => {
  let latest = 0;
  return {
    start() { latest += 1; return latest; },
    isLatest(id) { return id === latest; }
  };
};
