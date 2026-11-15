import assert from 'node:assert/strict';
import test from 'node:test';
import { createListingSubmissionLock, validateListingForm } from '../src/utils/listingForm.js';

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
