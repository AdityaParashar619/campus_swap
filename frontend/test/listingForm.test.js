import assert from 'node:assert/strict';
import test from 'node:test';
import { buildListingQuery, createLatestRequestGuard, createListingSubmissionLock, DEFAULT_DISCOVERY_FILTERS, getMarketplaceImageUrl, mergeListingUpdate, scheduleDiscoverySearch, validateDiscoveryPrices, validateListingForm, validateSelectedImages } from '../src/utils/listingForm.js';

const validForm = { title: '  Calculator  ', description: '  Works well  ', category: 'Electronics', condition: 'good', price: '499.99', location: '  Hostel A  ' };

test('listing form normalizes valid creation and editing values', () => {
  const result = validateListingForm(validForm);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.values, { title: 'Calculator', description: 'Works well', category: 'Electronics', condition: 'good', price: 499.99, location: 'Hostel A' });
});

test('listing form preserves input while reporting numeric and text errors', () => {
  const form = { ...validForm, title: ' ', price: '-5' };
  const result = validateListingForm(form);
  assert.equal(result.errors.title, 'Title is required.');
  assert.match(result.errors.price, /between INR 0/);
  assert.equal(form.price, '-5');
});

test('submission lock rejects duplicate requests until the first request releases it', () => {
  const lock = createListingSubmissionLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.release();
  assert.equal(lock.tryLock(), true);
});

test('partial listing updates preserve populated seller data for owner controls', () => {
  const current = { _id: 'listing-1', availability: 'available', user: { _id: 'owner-a', name: 'Student' } };
  const merged = mergeListingUpdate(current, { _id: 'listing-1', availability: 'sold' });
  assert.equal(merged.availability, 'sold');
  assert.deepEqual(merged.user, current.user);
});

test('image selection accepts supported files and rejects invalid type, size, and count', () => {
  const jpeg = { name: 'item.jpg', type: 'image/jpeg', size: 1024 };
  assert.deepEqual(validateSelectedImages([jpeg], 0).accepted, [jpeg]);
  assert.match(validateSelectedImages([{ name: 'item.gif', type: 'image/gif', size: 100 }], 0).errors[0], /JPEG/);
  assert.match(validateSelectedImages([{ name: 'huge.png', type: 'image/png', size: 6 * 1024 * 1024 }], 0).errors[0], /5 MB/);
  assert.match(validateSelectedImages([jpeg], 5).errors[0], /up to 5/);
});

test('marketplace cards transform only Cloudinary delivery URLs', () => {
  assert.equal(getMarketplaceImageUrl('https://legacy.example/item.jpg'), 'https://legacy.example/item.jpg');
  assert.equal(getMarketplaceImageUrl('https://res.cloudinary.com/demo/image/upload/v1/item.jpg'), 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_600,h_400/v1/item.jpg');
});

test('listing discovery query combines search, filters, sorting, and pagination', () => {
  const query = buildListingQuery({ ...DEFAULT_DISCOVERY_FILTERS, search: '  desk  ', category: 'Furniture', condition: 'good', minPrice: '0', maxPrice: '500', availability: 'available', sort: 'price_asc' }, 2);
  assert.deepEqual(query, { page: 2, limit: 12, sort: 'price_asc', search: 'desk', category: 'Furniture', condition: 'good', minPrice: '0', maxPrice: '500', availability: 'available' });
  assert.deepEqual(buildListingQuery(DEFAULT_DISCOVERY_FILTERS), { page: 1, limit: 12, sort: 'newest' });
});

test('discovery price validation handles invalid and reversed ranges', () => {
  assert.deepEqual(validateDiscoveryPrices({ minPrice: '0', maxPrice: '10.50' }), {});
  assert.match(validateDiscoveryPrices({ minPrice: '-1', maxPrice: '' }).minPrice, /Enter a price/);
  assert.match(validateDiscoveryPrices({ minPrice: '20', maxPrice: '10' }).maxPrice, /at least/);
});

test('search scheduling debounces by cancelling the superseded callback', () => {
  const pending = new Map(); let nextId = 0; const calls = [];
  const timers = { setTimeout(callback, delay) { const id = ++nextId; pending.set(id, { callback, delay }); return id; }, clearTimeout(id) { pending.delete(id); } };
  const cancelFirst = scheduleDiscoverySearch(() => calls.push('old'), 300, timers);
  cancelFirst();
  scheduleDiscoverySearch(() => calls.push('new'), 300, timers);
  assert.deepEqual([...pending.values()].map(({ delay }) => delay), [300]);
  for (const { callback } of pending.values()) callback();
  assert.deepEqual(calls, ['new']);
});

test('latest-request guard prevents stale responses from winning', () => {
  const guard = createLatestRequestGuard();
  const first = guard.start(); const second = guard.start();
  assert.equal(guard.isLatest(first), false);
  assert.equal(guard.isLatest(second), true);
});
