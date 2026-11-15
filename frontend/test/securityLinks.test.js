import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeTokenFragment, resolveSocketUrl } from '../src/utils/securityLinks.js';

test('socket URL uses the configured origin or same-origin fallback', () => {
  assert.equal(resolveSocketUrl('', 'https://campusswap.example'), 'https://campusswap.example');
  assert.equal(resolveSocketUrl(' https://api.example ', 'https://web.example'), 'https://api.example');
});

test('token fragment is consumed and removed from browser history', () => {
  let replaced;
  const location = { pathname: '/reset-password', search: '?source=email' };
  const token = consumeTokenFragment('#token=one-time%2Btoken', location, {
    replaceState: (...args) => { replaced = args; }
  });

  assert.equal(token, 'one-time+token');
  assert.deepEqual(replaced, [null, '', '/reset-password?source=email']);
});

test('missing token fragment does not rewrite browser history', () => {
  let replaced = false;
  const token = consumeTokenFragment('', { pathname: '/', search: '' }, {
    replaceState: () => { replaced = true; }
  });
  assert.equal(token, '');
  assert.equal(replaced, false);
});
