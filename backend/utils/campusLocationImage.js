export const CAMPUS_LOCATION_IMAGE_ORIGINS = Object.freeze([
  'https://res.cloudinary.com',
  'https://content.jdmagicbox.com',
  'https://lh3.googleusercontent.com'
]);

export function isCampusLocationImageUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && CAMPUS_LOCATION_IMAGE_ORIGINS.includes(url.origin);
  } catch {
    return false;
  }
}
