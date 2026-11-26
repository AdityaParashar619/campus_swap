export const CAMPUS_CATEGORIES = [
  'academic', 'administration', 'library', 'hostel', 'sports', 'food', 'medical', 'parking', 'facility', 'other'
];

export const LOCATION_DETAILS = {
  buildingCode: 'Building code',
  addressDescription: 'Address',
  floorInformation: 'Floor information',
  accessibilityNotes: 'Accessibility',
  openingHoursText: 'Opening hours',
  contactInformation: 'Contact'
};

export const validCoordinates = (value) => Number.isFinite(value?.latitude) && Math.abs(value.latitude) <= 90
  && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;

export function normalizeLocation(value) {
  if (!validCoordinates(value) || !/^[a-f0-9]{24}$/i.test(value.id ?? '')
    || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()
    || !CAMPUS_CATEGORIES.includes(value.category)) return null;
  const { id, name, category, latitude, longitude } = value;
  const location = { id, name, category, latitude, longitude };
  for (const field of ['description', ...Object.keys(LOCATION_DETAILS)]) {
    if (typeof value[field] === 'string' && value[field].trim()) location[field] = value[field];
  }
  if (value.imageUnavailable === true) location.imageUnavailable = true;
  if (typeof value.imageUrl === 'string' && value.imageUrl.trim()) {
    try {
      const url = new URL(value.imageUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) location.imageUrl = url.href;
    } catch { /* Unavailable images use the detail fallback. */ }
    if (!location.imageUrl) location.imageUnavailable = true;
  }
  return location;
}

export function directionsUrl(location) {
  if (!validCoordinates(location)) return null;
  const query = new URLSearchParams({ api: '1', destination: `${location.latitude},${location.longitude}` });
  return `https://www.google.com/maps/dir/?${query}`;
}

export async function loadCampusLocations(getPage, filters, signal) {
  const locations = [];
  const ids = new Set();
  let totalPages = 1;
  let total;
  for (let page = 1; page <= totalPages; page++) {
    signal.throwIfAborted();
    const { data: payload } = await getPage({ ...filters, page, limit: 50 }, { signal });
    signal.throwIfAborted();
    const reported = payload?.pagination?.totalPages;
    const reportedTotal = payload?.pagination?.total;
    if (!payload?.success || !Array.isArray(payload.data) || payload.pagination?.page !== page
      || !Number.isInteger(reportedTotal) || reportedTotal < 0 || reportedTotal > 500_000
      || reported !== Math.ceil(reportedTotal / 50)) {
      throw new Error('The campus location response was incomplete.');
    }
    if ((page > 1 && reportedTotal !== total) || payload.data.length !== Math.min(50, reportedTotal - (page - 1) * 50)) {
      throw new Error('Campus locations changed while loading. Please retry.');
    }
    total = reportedTotal;
    totalPages = reported;
    for (const raw of payload.data) {
      const location = normalizeLocation(raw);
      if (!location) continue;
      if (ids.has(location.id)) throw new Error('Campus locations changed while loading. Please retry.');
      ids.add(location.id);
      locations.push(location);
    }
  }
  return locations;
}
