import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAuthRequest, shouldRefreshAfterUnauthorized } from '../src/utils/authRequestPolicy.js';

test('unauthenticated public auth requests do not initiate refresh retries', () => {
  for (const url of ['/auth/login', '/auth/register/student', '/auth/register/alumni', '/auth/verify-email', '/auth/forgot-password', '/auth/verify-reset-otp']) {
    assert.equal(isPublicAuthRequest(url), true);
    assert.equal(shouldRefreshAfterUnauthorized({ status: 401, url }), false);
  }
});

test('protected requests refresh once, but refresh and retried requests do not loop', () => {
  assert.equal(shouldRefreshAfterUnauthorized({ status: 401, url: '/listings' }), true);
  assert.equal(shouldRefreshAfterUnauthorized({ status: 401, url: '/listings', retried: true }), false);
  assert.equal(shouldRefreshAfterUnauthorized({ status: 401, url: '/auth/refresh' }), false);
  assert.equal(shouldRefreshAfterUnauthorized({ status: 403, url: '/listings' }), false);
});
