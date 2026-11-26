import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { directionsUrl, loadCampusLocations, normalizeLocation } from '../src/utils/campusMap.js';

const location = (index, extra = {}) => ({
  id: index.toString(16).padStart(24, '0'), name: `Fictional location ${index}`,
  category: 'library', latitude: 23.5, longitude: 78, ...extra
});
const fixtures = Array.from({ length: 105 }, (_, index) => location(index));
const pageOf = (page, items = fixtures) => ({ data: {
  success: true, data: items.slice((page - 1) * 50, page * 50),
  pagination: { page, limit: 50, total: items.length, totalPages: Math.ceil(items.length / 50) }
} });

test('Campus Map is lazy loaded behind the existing protected route', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /CampusMap = lazy/);
  assert.match(app, /path="\/campus-map" element=\{<ProtectedRoute><CampusMap/);
});

test('location API pagination loads all pages sequentially with the search and category', async () => {
  const signal = new AbortController().signal;
  const calls = [];
  const getPage = async (params, options) => {
    assert.equal(options.signal, signal);
    calls.push(params);
    return pageOf(params.page);
  };
  const filters = { category: 'library', search: 'Atlas [A]' };
  assert.deepEqual(await loadCampusLocations(getPage, filters, signal), fixtures);
  assert.deepEqual(calls, [1, 2, 3].map((page) => ({ ...filters, page, limit: 50 })));
});

test('an empty catalogue makes one request and malformed pagination is treated as an error', async () => {
  const signal = new AbortController().signal;
  let requests = 0;
  const getPage = async ({ page }) => { requests++; return pageOf(page, []); };
  assert.deepEqual(await loadCampusLocations(getPage, {}, signal), []);
  assert.equal(requests, 1);
  await assert.rejects(loadCampusLocations(async () => ({ data: { data: [] } }), {}, signal), /incomplete/);
  await assert.rejects(loadCampusLocations(async ({ page }) => pageOf(page, page === 1 ? fixtures : fixtures.slice(1)), {}, signal), /changed/);
});

test('a stale request is discarded even when the transport resolves after cancellation', async () => {
  const controller = new AbortController();
  let requests = 0;
  const getPage = async () => {
    requests++;
    controller.abort();
    return pageOf(1);
  };
  await assert.rejects(loadCampusLocations(getPage, {}, controller.signal), { name: 'AbortError' });
  assert.equal(requests, 1);
});

test('invalid coordinates and unknown categories do not become markers', async () => {
  for (const extra of [{ latitude: '23.5' }, { latitude: 91 }, { longitude: NaN },
    { longitude: -181 }, { longitude: null }, { category: 'fake' }]) {
    assert.equal(normalizeLocation(location(1, extra)), null);
  }
  const expected = location(2);
  const results = await loadCampusLocations(async () => pageOf(1, [location(1, { latitude: Infinity }), expected]), {}, new AbortController().signal);
  assert.deepEqual(results, [expected]);
});

test('public details omit missing fields, unsafe images, external map URLs and audit data', () => {
  const raw = location(1, {
    description: 'Fictional details', openingHoursText: '', imageUrl: 'javascript:alert(1)',
    externalMapUrl: 'https://example.invalid/', coordinateVerifiedBy: 'private', createdBy: 'private'
  });
  assert.deepEqual(normalizeLocation(raw), location(1, { description: 'Fictional details', imageUnavailable: true }));
  assert.deepEqual(normalizeLocation(location(2, { imageUnavailable: true })), location(2, { imageUnavailable: true }));
  assert.equal(normalizeLocation(location(1, { imageUrl: 'https://example.invalid/a.jpg' })).imageUrl, 'https://example.invalid/a.jpg');
});

test('directions use latitude first and only include a Google Maps destination', () => {
  const url = new URL(directionsUrl(location(1)));
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/');
  assert.deepEqual([...url.searchParams], [['api', '1'], ['destination', '23.5,78']]);
  assert.equal(directionsUrl({ latitude: 0, longitude: 300 }), null);
});
