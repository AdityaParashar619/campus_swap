import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_NAVIGATION, getAccountIdentity, getNavigationLinks } from '../src/utils/navigation.js';

test('student navigation contains every primary destination without admin access', () => {
  const links = getNavigationLinks('student');
  assert.deepEqual(links, BASE_NAVIGATION);
  assert.equal(links.some((link) => link.href === '/admin'), false);
});

test('each supported administrator role receives the admin destination', () => {
  for (const role of ['admin', 'college_admin', 'super_admin']) {
    assert.equal(getNavigationLinks(role).at(-1).href, '/admin');
  }
});

test('navigation results cannot mutate the shared primary navigation definition', () => {
  const links = getNavigationLinks('student');
  links.pop();
  assert.equal(BASE_NAVIGATION.length, 8);
});

test('account identity normalizes display names and produces bounded initials', () => {
  assert.deepEqual(getAccountIdentity('  Paras Kumar Singh  '), { displayName: 'Paras Kumar Singh', initials: 'PK' });
  assert.deepEqual(getAccountIdentity(''), { displayName: 'Profile', initials: 'P' });
});
