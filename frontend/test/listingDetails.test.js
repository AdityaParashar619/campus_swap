import assert from 'node:assert/strict';
import test from 'node:test';
import { canContactListingSeller, createListingChatContext, isListingOwner, normalizeGalleryImages } from '../src/utils/listingDetails.js';

const listing = { _id: 'listing-1', title: 'Calculator', availability: 'available', user: { _id: 'seller-a' } };

test('owner-only controls and self-contact use the backend seller identity', () => {
  assert.equal(isListingOwner(listing, 'seller-a'), true);
  assert.equal(isListingOwner(listing, 'buyer-a'), false);
  assert.equal(canContactListingSeller(listing, 'seller-a'), false);
  assert.equal(canContactListingSeller(listing, 'buyer-a'), true);
  assert.equal(canContactListingSeller({ ...listing, availability: 'sold' }, 'buyer-a'), false);
});

test('contact seller preserves listing context without changing the message model', () => {
  assert.deepEqual(createListingChatContext(listing), { listingId: 'listing-1', title: 'Calculator', draft: 'Hi, I\'m interested in “Calculator”. Is it still available?' });
});

test('gallery accepts at most five valid legacy or Cloudinary image references', () => {
  const images = ['one', '', null, 'two', 'three', 'four', 'five', 'six'];
  assert.deepEqual(normalizeGalleryImages(images), ['one', 'two', 'three', 'four', 'five']);
  assert.deepEqual(normalizeGalleryImages(undefined), []);
});

