import { CAMPUS_CATEGORIES, validCoordinates } from './campusMap.js';

export const ADVANCED_FIELDS = [
  ['addressDescription', 'Address description', 500],
  ['floorInformation', 'Floor information', 500],
  ['accessibilityNotes', 'Accessibility notes', 500],
  ['openingHoursText', 'Opening hours', 300],
  ['contactInformation', 'Contact information', 300],
  ['imageUrl', 'Image URL', 2048],
  ['externalMapUrl', 'External map URL', 2048]
];

const textFields = [
  ['name', 'Location name', 120], ['description', 'Description', 2000], ...ADVANCED_FIELDS
];

export function locationToForm(location = {}) {
  return {
    ...Object.fromEntries(textFields.map(([key]) => [key, location[key] ?? ''])),
    category: location.category ?? '',
    buildingCode: location.buildingCode ?? '',
    aliases: (location.aliases ?? []).join('\n'),
    latitude: String(location.latitude ?? ''),
    longitude: String(location.longitude ?? '')
  };
}

export function readCoordinate(value, limit) {
  const text = value.trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
  const number = Number(text);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : NaN;
}

function safeHttps(value) {
  try {
    const url = new URL(value);
    return /^https:\/\//i.test(value) && url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function buildLocationPayload(form) {
  const result = {};
  for (const [key, label, max] of textFields) {
    const value = form[key].trim();
    if (value.length > max) throw new Error(`${label} must be at most ${max} characters.`);
    if (key.endsWith('Url') && value && !safeHttps(value)) throw new Error(`${label} must be a valid HTTPS URL without credentials.`);
    result[key] = value;
  }
  if (!result.name) throw new Error('Enter a location name.');
  if (!CAMPUS_CATEGORIES.includes(form.category)) throw new Error('Select a category.');
  result.category = form.category;
  result.buildingCode = form.buildingCode.trim().toUpperCase();
  if (result.buildingCode && !/^[A-Z0-9][A-Z0-9_-]{0,23}$/.test(result.buildingCode)) {
    throw new Error('Use up to 24 letters, digits, hyphens, or underscores for the building code. Start with a letter or digit.');
  }
  result.aliases = [...new Set(form.aliases.split('\n').map((alias) => alias.trim()).filter(Boolean))];
  if (result.aliases.length > 10 || result.aliases.some((alias) => alias.length > 120)) {
    throw new Error('Enter up to 10 aliases, each at most 120 characters.');
  }
  for (const [key, limit] of [['latitude', 90], ['longitude', 180]]) {
    result[key] = readCoordinate(form[key], limit);
    if (Number.isNaN(result[key])) throw new Error(`Enter a numeric ${key} between −${limit} and ${limit}, or leave it blank.`);
  }
  return result;
}

export function locationChanges(saved, payload) {
  const before = buildLocationPayload(locationToForm(saved));
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) =>
    key === 'aliases' ? JSON.stringify(value) !== JSON.stringify(before[key]) : value !== before[key]
  ));
}

export const canPublishLocation = (location) => validCoordinates(location)
  && location.coordinateVerificationStatus === 'verified' && location.status !== 'published';
