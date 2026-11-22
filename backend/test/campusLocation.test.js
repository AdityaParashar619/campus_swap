import assert from 'node:assert/strict';
import test from 'node:test';
import CampusLocation from '../models/CampusLocation.js';
import { normalizeLocation, parseLocationList, readCoordinateReview } from '../utils/campusLocationValidation.js';

const actor = '507f1f77bcf86cd799439011';
const base = { name: 'Test building', category: 'academic', createdBy: actor, updatedBy: actor };

test('drafts may omit coordinates and valid numbers do not establish verification', async () => {
  const draft = new CampusLocation(base);
  await draft.validate();
  assert.equal(draft.status, 'draft');
  assert.equal(draft.latitude, null);
  const point = new CampusLocation({ ...base, latitude: -90, longitude: 180 });
  await point.validate();
  assert.equal(point.coordinateVerificationStatus, 'unverified');
  point.status = 'published';
  point.publishedAt = new Date();
  await assert.rejects(point.validate(), /verified coordinates/i);
  point.coordinateVerificationStatus = 'verified';
  await assert.rejects(point.validate(), /verification audit/i);
});

test('API and model reject malformed and out-of-range coordinates without coercing strings', async () => {
  for (const [field, values] of Object.entries({
    latitude: [-91, 91, NaN, Infinity, '12', '', true, {}],
    longitude: [-181, 181, NaN, -Infinity, '77', [], false]
  })) {
    for (const value of values) {
      assert.throws(() => normalizeLocation({ [field]: value }, true), new RegExp(field));
      await assert.rejects(new CampusLocation({ ...base, [field]: value }).validate(), new RegExp(field));
    }
  }
  assert.deepEqual(normalizeLocation({ latitude: 0, longitude: -180 }, true), { latitude: 0, longitude: -180 });
});

test('editable input and coordinate review reject forged fields and unsafe links', () => {
  for (const field of ['status', 'createdBy', 'updatedBy', 'coordinateSource', 'coordinateVerifiedBy', 'coordinateVerifiedAt', 'coordinateVerificationStatus', 'publishedAt', 'archivedAt', 'unknown']) {
    assert.throws(() => normalizeLocation({ [field]: 'fake' }, true), /Unexpected fields/);
  }
  assert.throws(() => readCoordinateReview({ latitude: 0, longitude: 0, coordinateSource: 'fixture', coordinateVerifiedBy: actor }), /Unexpected fields/);
  for (const link of ['javascript:void(0)', 'http://example.invalid', 'https://user@example.invalid', '//example.invalid']) {
    assert.throws(() => normalizeLocation({ imageUrl: link }, true), /HTTPS/);
    assert.throws(() => normalizeLocation({ externalMapUrl: link }, true), /HTTPS/);
  }
});

test('search treats punctuation literally and bounds categories, statuses and pagination', () => {
  const { filter, skip } = parseLocationList({ search: 'A.*', category: 'library', status: 'draft', page: '2', limit: '3' }, true);
  assert.deepEqual(filter.$or.map((clause) => Object.keys(clause)[0]), ['name', 'buildingCode', 'aliases']);
  assert.equal(filter.$or[0].name.test('a.*'), true);
  assert.equal(filter.$or[0].name.test('Academic'), false);
  assert.equal(skip, 3);
  for (const query of [{ limit: '51' }, { page: '10001' }, { search: 'x'.repeat(101) }, { category: 'fake' }, { status: 'draft' }]) {
    assert.throws(() => parseLocationList(query));
  }
});
