import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListingDiscoveryQuery } from '../utils/listingDiscovery.js';
import Listing from '../models/Listing.js';
import { getListings } from '../controllers/listingController.js';

const invoke = (handler, req) => new Promise((resolve) => {
  const res = { json(body) { this.body = body; resolve({ res: this }); } };
  handler(req, res, (error) => resolve({ res, error }));
});

test('discovery defaults to stable newest pagination', () => {
  const result = parseListingDiscoveryQuery({});
  assert.deepEqual(result.filter, { isHidden: { $ne: true } });
  assert.deepEqual({ page: result.page, limit: result.limit, skip: result.skip }, { page: 1, limit: 12, skip: 0 });
  assert.deepEqual(result.sort, { createdAt: -1, _id: -1 });
});

test('title and description search uses the existing text index and trims input', () => {
  assert.deepEqual(parseListingDiscoveryQuery({ search: '  calculator notes  ' }).filter.$text, { $search: 'calculator notes' });
  assert.equal(parseListingDiscoveryQuery({ search: '   ' }).filter.$text, undefined);
});

test('search rejects excessive and non-scalar values', () => {
  assert.throws(() => parseListingDiscoveryQuery({ search: 'x'.repeat(101) }), /100 characters/);
  assert.throws(() => parseListingDiscoveryQuery({ search: ['$ne'] }), /single text value/);
  assert.throws(() => parseListingDiscoveryQuery({ search: { $ne: '' } }), /single text value/);
});

test('combined filters retain hidden exclusion and numeric zero', () => {
  const { filter } = parseListingDiscoveryQuery({ category: 'electronics', condition: 'good', availability: 'available', minPrice: '0', maxPrice: '500.25' });
  assert.deepEqual(filter, {
    isHidden: { $ne: true },
    category: { $in: ['Electronics', 'electronics'] },
    condition: 'good',
    availability: 'available',
    price: { $gte: 0, $lte: 500.25 }
  });
});

test('legacy lowercase categories map to the canonical category filter', () => {
  assert.deepEqual(parseListingDiscoveryQuery({ category: 'textbooks' }).filter.category, { $in: ['Textbooks', 'textbooks'] });
});

test('invalid enums and unsupported query fields are rejected', () => {
  for (const query of [{ category: 'toys' }, { condition: 'broken' }, { availability: 'hidden' }, { sort: 'popular' }, { $where: 'x' }]) {
    assert.throws(() => parseListingDiscoveryQuery(query));
  }
});

test('prices reject negatives, malformed values, excess precision, and reversed ranges', () => {
  for (const query of [{ minPrice: '-1' }, { minPrice: 'Infinity' }, { minPrice: '1e3' }, { maxPrice: '1.999' }, { minPrice: '20', maxPrice: '10' }]) {
    assert.throws(() => parseListingDiscoveryQuery(query));
  }
});

test('sorting is deterministic for both price directions', () => {
  assert.deepEqual(parseListingDiscoveryQuery({ sort: 'price_asc' }).sort, { price: 1, _id: 1 });
  assert.deepEqual(parseListingDiscoveryQuery({ sort: 'price_desc' }).sort, { price: -1, _id: -1 });
});

test('custom pagination validates positive integers and maximum limit', () => {
  const valid = parseListingDiscoveryQuery({ page: '3', limit: '25' });
  assert.deepEqual({ page: valid.page, limit: valid.limit, skip: valid.skip }, { page: 3, limit: 25, skip: 50 });
  for (const query of [{ page: '0' }, { page: '1.5' }, { limit: '0' }, { limit: '51' }, { page: '1000000', limit: '50' }]) {
    assert.throws(() => parseListingDiscoveryQuery(query));
  }
});

test('controller applies discovery before pagination and returns complete metadata for an empty out-of-range page', { concurrency: false }, async () => {
  const originals = { find: Listing.find, count: Listing.countDocuments };
  let observed = {};
  Listing.find = (filter) => ({
    populate() { return this; },
    sort(value) { observed.sort = value; return this; },
    skip(value) { observed.skip = value; return this; },
    limit(value) { observed.limit = value; return this; },
    lean() { observed.lean = true; return this; },
    then(resolve, reject) { observed.filter = filter; return Promise.resolve([]).then(resolve, reject); }
  });
  Listing.countDocuments = async (filter) => { observed.countFilter = filter; return 13; };
  try {
    const { res, error } = await invoke(getListings, { query: { page: '3', limit: '6', availability: 'available', sort: 'price_desc' } });
    assert.equal(error, undefined);
    assert.deepEqual(observed.filter, observed.countFilter);
    assert.deepEqual(observed.sort, { price: -1, _id: -1 });
    assert.deepEqual({ skip: observed.skip, limit: observed.limit }, { skip: 12, limit: 6 });
    assert.equal(observed.lean, true);
    assert.deepEqual(res.body.data, []);
    assert.deepEqual(res.body.pagination, { page: 3, limit: 6, total: 13, totalPages: 3, hasNextPage: false, hasPreviousPage: true });
  } finally { Listing.find = originals.find; Listing.countDocuments = originals.count; }
});

