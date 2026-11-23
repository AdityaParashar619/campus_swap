import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLocationPayload, canPublishLocation, locationChanges, locationToForm, readCoordinate } from '../src/utils/campusLocationAdmin.js';

const saved = {
  _id: '507f1f77bcf86cd799439011', __v: 4, name: 'Fictional workshop', category: 'facility',
  buildingCode: 'TEST-1', aliases: ['Lab, East', 'Workshop'], latitude: 23.501234567891234,
  longitude: 78.001234567891234, openingHoursText: 'Synthetic hours', imageUrl: 'https://example.invalid/photo.jpg',
  coordinateVerificationStatus: 'verified', coordinateSource: 'Fictional provenance', status: 'draft'
};

test('admin route uses the existing admin guard and panel link', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.match(read('../src/App.jsx'), /path="\/admin\/campus-locations" element=\{<AdminRoute><AdminCampusLocations/);
  assert.match(read('../src/pages/Admin.jsx'), /to="\/admin\/campus-locations"/);
  assert.doesNotMatch(read('../src/pages/CampusMap.jsx'), /adminCampusLocationAPI|Verify Coordinates/);
});

test('form round-trips full coordinate precision and advanced data, excluding server fields', () => {
  const form = locationToForm(saved);
  const payload = buildLocationPayload(form);
  assert.equal(payload.latitude, saved.latitude);
  assert.equal(payload.longitude, saved.longitude);
  assert.deepEqual(payload.aliases, saved.aliases);
  assert.equal(payload.openingHoursText, saved.openingHoursText);
  assert.equal(payload.imageUrl, saved.imageUrl);
  for (const field of ['_id', '__v', 'status', 'coordinateSource', 'coordinateVerificationStatus']) assert.equal(field in payload, false);
  assert.deepEqual(locationChanges(saved, buildLocationPayload({ ...form, latitude: '', description: 'Edited' })),
    { latitude: null, description: 'Edited' });
});

test('invalid coordinates and unsafe or credentialed links are rejected', () => {
  for (const value of ['91', 'NaN', 'Infinity', '0x7', '12,5', '1.2.3']) assert.ok(Number.isNaN(readCoordinate(value, 90)));
  assert.equal(readCoordinate('  ', 90), null);
  assert.equal(readCoordinate('0', 90), 0);
  assert.equal(readCoordinate('1e-8', 90), 1e-8);
  for (const imageUrl of ['http://example.invalid', 'https://user@example.invalid', 'javascript:void(0)']) {
    assert.throws(() => buildLocationPayload({ ...locationToForm(saved), imageUrl }), /HTTPS/);
  }
});

test('publication requires a verified saved pair and is available again after archive', () => {
  assert.equal(canPublishLocation(saved), true);
  assert.equal(canPublishLocation({ ...saved, status: 'archived' }), true);
  assert.equal(canPublishLocation({ ...saved, status: 'published' }), false);
  assert.equal(canPublishLocation({ ...saved, latitude: null }), false);
  assert.equal(canPublishLocation({ ...saved, coordinateVerificationStatus: 'unverified' }), false);
});
