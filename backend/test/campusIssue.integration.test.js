import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';

const uri = process.env.CAMPUS_ISSUE_TEST_MONGO_URI;
test('private Campus Issues HTTP workflow, map visibility and concurrent reviews', { skip: !uri, timeout: 30000 }, async () => {
  if (uri !== 'mongodb://127.0.0.1:27019/campusswap_issues_test') throw new Error('Use the isolated issue test database on port 27019');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-campus-issues-test-secret';
  const [{ createApp }, { signAuthToken }, { default: User }, { default: CampusIssue }, { default: CampusLocation }] = await Promise.all([
    import('../app.js'), import('../utils/auth.js'), import('../models/User.js'),
    import('../models/CampusIssue.js'), import('../models/CampusLocation.js')
  ]);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const users = [];
  const marker = randomUUID();
  let server;
  try {
    for (const [index, role] of ['student', 'student', 'admin'].entries()) {
      users.push(await User.create({
        name: role, role, email: `${marker}-${index}@satiengg.in`, password: 'unused-fixture-hash',
        emailVerified: true, verificationStatus: 'verified', accountStatus: 'active'
      }));
    }
    const [owner, other, admin] = users;
    await new Promise((resolve, reject) => {
      server = createApp().listen(0, '127.0.0.1', resolve).once('error', reject);
    });
    async function call(path, user, method = 'GET', body, version) {
      const headers = { 'content-type': 'application/json' };
      if (user) headers.authorization = `Bearer ${signAuthToken({ userId: String(user._id), tokenVersion: 0 })}`;
      if (version !== undefined) headers['If-Match'] = `"${version}"`;
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { ...(await response.json()), code: response.status, cacheControl: response.headers.get('cache-control') };
    }
    const studentPath = '/api/campus-issues';
    const adminPath = '/api/admin/campus-issues';
    const submit = (body, user = owner) => call(studentPath, user, 'POST', body);
    const review = (id, body, version, user = admin) => call(`${adminPath}/${id}/status`, user, 'PATCH', body, version);
    const fixture = { title: `Synthetic water issue .* ${marker}`, category: 'water', description: 'Synthetic private report.', locationDescription: 'Near the fixture' };

    assert.equal((await call(studentPath, null, 'POST', fixture)).code, 401);
    assert.equal((await call(`${studentPath}/mine`, null)).code, 401);
    assert.equal((await call(studentPath, owner)).code, 404);
    assert.equal((await submit({ ...fixture, createdBy: String(other._id) })).code, 400);
    assert.equal((await submit({ ...fixture, status: 'resolved' })).code, 400);
    assert.equal((await submit({ ...fixture, campusLocation: 'not-an-id' })).code, 400);
    assert.equal((await submit({ ...fixture, campusLocation: String(new mongoose.Types.ObjectId()) })).code, 400);
    const actor = { createdBy: admin._id, updatedBy: admin._id };
    const draft = await CampusLocation.create({ name: `Draft fixture ${marker}`, category: 'other', ...actor });
    assert.equal((await submit({ ...fixture, campusLocation: String(draft._id) })).code, 400);
    const location = await CampusLocation.create({
      name: `Published fixture ${marker}`, category: 'facility', ...actor,
      latitude: 12, longitude: 35, status: 'published', publishedAt: new Date(),
      coordinateVerificationStatus: 'verified', coordinateSource: 'Private fixture provenance',
      coordinateVerifiedAt: new Date(), coordinateVerifiedBy: admin._id
    });
    const created = await submit({ ...fixture, campusLocation: String(location._id) });
    assert.equal(created.code, 201);
    assert.equal(created.cacheControl, 'no-store');
    const { id } = created.data;
    assert.equal(created.data.status, 'submitted');
    assert.deepEqual(created.data.campusLocation, { id: String(location._id), name: location.name });
    for (const key of ['createdBy', 'reviewedBy', 'version', 'attachments']) assert.equal(key in created.data, false);
    const mine = await call(`${studentPath}/mine?search=.*&limit=1`, owner);
    assert.equal(mine.pagination.total, 1);
    assert.equal(mine.data[0].id, id);
    assert.deepEqual((await call(`${studentPath}/mine`, other)).data, []);
    assert.equal((await call(`${studentPath}/${id}`, other)).code, 404);
    assert.equal((await call(adminPath, owner)).code, 403);
    assert.equal((await review(id, { status: 'under_review' }, 0, owner)).code, 403);

    location.status = 'archived';
    location.archivedAt = new Date();
    await location.save();
    const ownerDetail = await call(`${studentPath}/${id}`, owner);
    assert.equal(ownerDetail.data.campusLocation, null);
    assert.equal(ownerDetail.data.locationDescription, fixture.locationDescription);
    assert.equal((await submit({ ...fixture, campusLocation: String(location._id) })).code, 400);

    const queue = await call(`${adminPath}?status=submitted&category=water&search=${marker}`, admin);
    assert.equal(queue.pagination.total, 1);
    const adminDetail = await call(`${adminPath}/${id}`, admin);
    assert.equal(adminDetail.data.status, 'submitted');
    assert.equal(adminDetail.data.campusLocation, null);
    const { version } = adminDetail.data;
    assert.equal((await review(id, { status: 'under_review' })).code, 400);
    const racing = await Promise.all([
      review(id, { status: 'under_review' }, version),
      review(id, { status: 'under_review' }, version)
    ]);
    assert.deepEqual(racing.map(({ code }) => code).sort(), [200, 409]);
    const current = racing.find(({ code }) => code === 200).data;
    assert.equal(current.reviewedBy, String(admin._id));
    assert.ok(current.reviewedAt);
    assert.equal((await review(id, { status: 'resolved' }, current.version)).code, 400);

    const responded = await review(id, { status: 'under_review', adminResponse: 'The fixture was checked.' }, current.version);
    const resolved = await review(id, { status: 'resolved', resolutionNote: 'The synthetic repair is complete.' }, responded.data.version);
    assert.equal(resolved.data.status, 'resolved');
    assert.ok(resolved.data.resolvedAt);
    assert.equal(resolved.data.closedAt, null);
    const visible = (await call(`${studentPath}/${id}`, owner)).data;
    assert.equal(visible.status, 'resolved');
    assert.equal(visible.adminResponse, 'The fixture was checked.');
    assert.equal(visible.resolutionNote, 'The synthetic repair is complete.');
    assert.equal('reviewedBy' in visible, false);
    assert.equal((await review(id, { status: 'closed', resolutionNote: 'Duplicate fixture report.' }, resolved.data.version)).code, 409);

    const duplicate = await submit({ ...fixture, title: `Duplicate ${marker}` });
    const closed = await review(duplicate.data.id, { status: 'closed', resolutionNote: 'Duplicate fixture report.' }, 0);
    assert.equal(closed.data.status, 'closed');
    assert.ok(closed.data.closedAt);
    assert.equal(closed.data.resolvedAt, null);
  } finally {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      const fixtureOwners = users.map((user) => user._id);
      await CampusIssue.deleteMany({ createdBy: { $in: fixtureOwners } });
      await CampusLocation.deleteMany({ createdBy: { $in: fixtureOwners } });
      await User.deleteMany({ _id: { $in: fixtureOwners } });
    } finally { await mongoose.disconnect(); }
  }
});
