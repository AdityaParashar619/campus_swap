import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const uri = process.env.CAMPUS_LOCATION_TEST_MONGO_URI;
test('campus location HTTP lifecycle, visibility, filtering and concurrent edits', { skip: !uri }, async () => {
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):27018\/campusswap_locations_test$/.test(uri)) {
    throw new Error('Use the local disposable E2E MongoDB port and campusswap_locations_test database');
  }
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-campus-location-test-secret';
  const [{ createApp }, { default: User }, { default: CampusLocation }, { signAuthToken }] = await Promise.all([
    import('../app.js'), import('../models/User.js'), import('../models/CampusLocation.js'), import('../utils/auth.js')
  ]);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const marker = randomUUID();
  const users = [];
  let server;
  try {
    await CampusLocation.init();
    for (const role of ['admin', 'student']) {
      users.push(await User.create({
        name: role, email: `${marker}-${role}@satiengg.in`, password: 'unused-test-hash',
        role, emailVerified: true, verificationStatus: 'verified', accountStatus: 'active'
      }));
    }
    const [admin, student] = users;
    await new Promise((resolve, reject) => {
      server = createApp().listen(0, '127.0.0.1', resolve).once('error', reject);
    });
    async function call(path, user, method = 'GET', data) {
      const headers = { 'content-type': 'application/json' };
      if (user) headers.authorization = `Bearer ${signAuthToken({ userId: String(user._id), tokenVersion: 0 })}`;
      const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method, headers, body: data === undefined ? undefined : JSON.stringify(data)
      });
      return { status: res.status, ...(await res.json()) };
    }
    const writes = '/api/admin/campus-locations';
    const reads = '/api/campus-locations';
    const fixture = { name: `Synthetic ${marker}`, category: 'library', aliases: [`Study Hall ${marker}`], buildingCode: marker.slice(0, 8) };
    assert.equal((await call('/api/live')).status, 200);
    assert.equal((await call('/api/health')).status, 200);
    assert.equal((await call(reads)).status, 401);
    assert.equal((await call(writes, student, 'POST', fixture)).status, 403);
    assert.equal((await call(writes, admin, 'POST', { ...fixture, createdBy: student._id })).status, 400);
    const draft = await call(writes, admin, 'POST', fixture);
    assert.equal(draft.status, 201);
    assert.equal(draft.data.status, 'draft');
    assert.equal(draft.data.latitude, null);
    assert.equal(draft.data.createdBy, String(admin._id));
    assert.equal((await call(writes, admin, 'POST', { ...fixture, buildingCode: fixture.buildingCode.toUpperCase() })).status, 409);
    const edit = `${writes}/${draft.data._id}`;
    const view = `${reads}/${draft.data._id}`;
    const point = { latitude: 12.5, longitude: -45.75 };
    const review = { ...point, coordinateSource: 'Synthetic integration fixture' };
    const action = (name, data) => call(`${edit}/${name}`, admin, 'POST', data);

    assert.equal((await call(view, student)).status, 404);
    assert.equal((await action('verify-coordinates', review)).status, 400);
    assert.equal((await call(edit, admin, 'PATCH', { latitude: '12.5' })).status, 400);
    assert.equal((await call(edit, admin, 'PATCH', point)).data.coordinateVerificationStatus, 'unverified');
    assert.equal((await action('publish')).status, 400);
    assert.equal((await call(`${edit}/verify-coordinates`, student, 'POST', review)).status, 403);
    const verified = await action('verify-coordinates', review);
    assert.equal(verified.status, 200);
    assert.equal(verified.data.coordinateVerifiedBy, String(admin._id));
    assert.ok(verified.data.coordinateVerifiedAt);
    assert.equal((await action('publish')).status, 200);
    const visible = await call(view, student);
    assert.equal(visible.status, 200);
    assert.equal(visible.data.latitude, point.latitude);
    assert.equal(visible.data.longitude, point.longitude);
    for (const key of ['createdBy', 'updatedBy', 'coordinateVerifiedBy', 'coordinateSource', '__v']) assert.equal(key in visible.data, false);
    const edited = await call(edit, admin, 'PATCH', { description: 'Library fixture' });
    assert.equal(edited.data.coordinateVerifiedAt, verified.data.coordinateVerifiedAt);
    for (const search of ['study hall', fixture.buildingCode, fixture.name]) {
      const list = await call(`${reads}?category=library&limit=1&search=${encodeURIComponent(search)}`, student);
      assert.equal(list.pagination.total, 1);
      assert.equal(list.data[0].id, draft.data._id);
    }
    assert.equal((await call(`${reads}?category=sports&search=${marker}`, student)).pagination.total, 0);
    assert.equal((await call(`${reads}?search=.*`, student)).pagination.total, 0);
    assert.equal((await call(`${reads}?limit=51`, student)).status, 400);
    assert.equal((await call(`${writes}?status=published&search=${marker}`, admin)).pagination.total, 1);

    const stale = await CampusLocation.findById(draft.data._id);
    const changed = await call(edit, admin, 'PATCH', { latitude: 13.5 });
    assert.equal(changed.status, 200);
    assert.equal(changed.data.status, 'draft');
    assert.equal(changed.data.coordinateVerificationStatus, 'unverified');
    assert.equal(changed.data.coordinateVerifiedBy, null);
    stale.coordinateSource = 'Stale verification';
    await assert.rejects(stale.save(), mongoose.Error.VersionError);
    assert.equal((await call(view, student)).status, 404);
    assert.equal((await call(`${reads}?search=${marker}`, student)).pagination.total, 0);
    assert.equal((await action('publish')).status, 400);
    assert.equal((await action('verify-coordinates', review)).status, 409);
    assert.equal((await action('verify-coordinates', { ...review, latitude: 13.5 })).status, 200);
    assert.equal((await action('publish')).status, 200);
    assert.equal((await call(view, student)).data.latitude, 13.5);
    assert.equal((await action('archive')).status, 200);
    assert.equal((await call(view, student)).status, 404);
    assert.equal((await action('publish')).status, 200);
  } finally {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      await CampusLocation.deleteMany({ createdBy: { $in: users.map((user) => user._id) } });
      await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
    } finally { await mongoose.disconnect(); }
  }
});
