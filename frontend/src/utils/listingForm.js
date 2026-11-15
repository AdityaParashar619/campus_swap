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
