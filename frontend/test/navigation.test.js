import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BASE_NAVIGATION, COLLEGE_SERVICE_ITEMS, getAccountIdentity, getBrandDestination, getNavigationLinks, getNavigationSections, isNavigationActive } from '../src/utils/navigation.js';

test('student navigation includes Notes under Student Community without adding Dashboard', () => {
  const links = getNavigationLinks('student');
  for (const href of ['/listings', '/my-listings', '/saved-listings', '/chat', '/network', '/bounties', '/notes', '/profile']) {
    assert.equal(links.some((link) => link.href === href), true, `${href} should remain navigable`);
  }
  assert.equal(links.some((link) => link.href === '/admin'), false);
  assert.equal(links.some((link) => link.href === '/dashboard'), false);
  assert.equal(getBrandDestination({ role: 'student' }), '/dashboard');
  assert.equal(getBrandDestination(null), '/');
});

test('College Services enables My Department while keeping future modules unavailable', () => {
  const section = getNavigationSections('student').find((item) => item.id === 'college-services');
  assert.equal(section.status, undefined);
  assert.deepEqual(section.items, COLLEGE_SERVICE_ITEMS);
  assert.deepEqual(section.items.map((item) => item.label), ['My Department', 'Notice Board', 'Campus Map', 'Campus Issues']);
  assert.deepEqual(section.items[0], { href: '/my-department', label: 'My Department' });
  assert.equal(section.items.slice(1).every((item) => item.disabled && !item.href), true);
});

test('each supported administrator role receives the role-protected admin destination', () => {
  for (const role of ['admin', 'college_admin', 'super_admin']) assert.equal(getNavigationLinks(role).some((link) => link.href === '/admin'), true);
  for (const role of ['student', 'alumni', undefined]) assert.equal(getNavigationLinks(role).some((link) => link.href === '/admin'), false);
});

test('active route matching supports nested feature routes without activating Dashboard', () => {
  assert.equal(isNavigationActive('/listings/507f1f77bcf86cd799439011', '/listings'), true);
  assert.equal(isNavigationActive('/dashboard', '/dashboard'), true);
  assert.equal(isNavigationActive('/dashboard/stale', '/dashboard'), false);
  assert.equal(isNavigationActive('/chat', '/network'), false);
});

test('Notes route restores the existing workflow behind the protected route', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /import\('\.\/pages\/Notes'\)/);
  assert.match(app, /path="\/notes"[^\n]+ProtectedRoute><Notes/);
});

test('navigation results cannot mutate the shared primary navigation definition', () => {
  const links = getNavigationLinks('student');
  links.pop();
  assert.equal(BASE_NAVIGATION.length, 10);
});

test('account identity normalizes display names and produces bounded initials', () => {
  assert.deepEqual(getAccountIdentity('  Paras Kumar Singh  '), { displayName: 'Paras Kumar Singh', initials: 'PK' });
  assert.deepEqual(getAccountIdentity(''), { displayName: 'Profile', initials: 'P' });
});
