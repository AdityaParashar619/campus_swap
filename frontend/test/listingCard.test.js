import test from 'node:test';
import assert from 'node:assert/strict';
import { formatListingCondition, formatListingStatus } from '../src/utils/listingPresentation.js';

test('listing card presentation preserves supported statuses and safe fallback', () => {
  assert.equal(formatListingStatus('available'), 'Available');
  assert.equal(formatListingStatus('swapped'), 'Swapped');
  assert.equal(formatListingStatus('unsupported'), 'Available');
});

test('listing condition presentation converts stored values without changing data', () => {
  assert.equal(formatListingCondition('like_new'), 'like new');
  assert.equal(formatListingCondition(undefined), 'good');
});
