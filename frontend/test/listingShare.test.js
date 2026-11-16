import assert from 'node:assert/strict';
import test from 'node:test';
import { getCanonicalListingUrl, shareListing } from '../src/utils/listingShare.js';

const listing = { _id: 'listing 1', title: 'Calculator' };

test('sharing builds a canonical token-free product URL', () => {
  assert.equal(getCanonicalListingUrl(listing._id, 'https://campus.example/'), 'https://campus.example/listings/listing%201');
});

test('native sharing receives product context and reports success', async () => {
  let payload; const result = await shareListing({ listing, origin: 'https://campus.example', navigatorApi: { share: async (value) => { payload = value; } } });
  assert.equal(result.status, 'shared'); assert.equal(payload.url, 'https://campus.example/listings/listing%201');
});

test('clipboard fallback copies the canonical URL', async () => {
  let copied; const result = await shareListing({ listing, origin: 'https://campus.example', navigatorApi: { clipboard: { writeText: async (value) => { copied = value; } } } });
  assert.equal(result.status, 'copied'); assert.equal(copied, result.url);
});

test('native share cancellation is not reported as an error or copied', async () => {
  let copied = false; const abort = new Error('cancel'); abort.name = 'AbortError';
  const result = await shareListing({ listing, navigatorApi: { share: async () => { throw abort; }, clipboard: { writeText: async () => { copied = true; } } } });
  assert.equal(result.status, 'cancelled'); assert.equal(copied, false);
});

test('sharing reports unavailable browser capabilities', async () => {
  await assert.rejects(shareListing({ listing, navigatorApi: {}, origin: 'https://campus.example' }), /unavailable/);
});

