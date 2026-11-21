import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import Notice from '../models/Notice.js';
import User from '../models/User.js';

const uri = process.env.TEST_MONGO_URI || '';
const integration = uri ? test : test.skip;

integration('Notice APIs enforce lifecycle, targeting, isolation, search, and pagination', { concurrency: false }, async () => {
  const databaseName = new URL(uri).pathname.slice(1);
  if (!/_test$/i.test(databaseName)) throw new Error('TEST_MONGO_URI must end in _test');
  await mongoose.connect(uri);
  const marker = `notice-${Date.now()}`;
  let server;
  try {
    const users = await User.create([
      { name: 'Notice Admin', email: `${marker}-admin@satiengg.in`, password: 'unused-test-hash', role: 'admin', accountType: 'staff', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active' },
      { name: 'CSE Seven', email: `${marker}-cse7@satiengg.in`, password: 'unused-test-hash', role: 'student', accountType: 'student', branch: 'cs', semester: '7', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active' },
      { name: 'CSE Five', email: `${marker}-cse5@satiengg.in`, password: 'unused-test-hash', role: 'student', accountType: 'student', branch: 'cs', semester: '5', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active' },
      { name: 'EC Five', email: `${marker}-ec5@satiengg.in`, password: 'unused-test-hash', role: 'student', accountType: 'student', branch: 'ec', semester: '5', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active' }
    ]);
    const token = (user) => jwt.sign({ userId: user._id.toString(), tokenVersion: 0 }, env.jwtSecret, { expiresIn: '5m' });
    const app = createApp({ databaseMiddleware: (_req, _res, next) => next() });
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, user, options = {}) => {
      const response = await fetch(`${origin}${path}`, { ...options, headers: { 'content-type': 'application/json', authorization: `Bearer ${token(user)}`, ...(options.headers || {}) } });
      return { status: response.status, body: await response.json() };
    };
    const create = (data) => call('/api/admin/notices', users[0], { method: 'POST', body: JSON.stringify(data) });
    const publish = (id) => call(`/api/admin/notices/${id}/publish`, users[0], { method: 'POST', body: '{}' });

    const draft = await create({ title: `${marker} draft`, content: 'draft content', category: 'academic', targetScope: 'college' });
    assert.equal(draft.status, 201); assert.equal(draft.body.data.status, 'draft');
    assert.equal((await call('/api/admin/notices', users[1], { method: 'POST', body: JSON.stringify({ title: 'forbidden', content: 'x' }) })).status, 403);
    assert.equal((await call('/api/notices', users[1])).body.data.some((item) => item.id === draft.body.data._id), false);

    const college = await create({ title: `${marker} college`, content: 'all students', targetScope: 'college' });
    const collegePublished = await publish(college.body.data._id); assert.equal(collegePublished.status, 200); assert.equal(collegePublished.body.data.status, 'published');
    for (const student of users.slice(1)) assert.equal((await call('/api/notices', student)).body.data.some((item) => item.id === college.body.data._id), true);

    const cse = await create({ title: `${marker} CSE placement`, content: 'CSE only searchable phrase', category: 'placement', targetScope: 'program', targetPrograms: ['CSE'] });
    const csePublication = await publish(cse.body.data._id);
    const originalPublishedAt = csePublication.body.data.publishedAt;
    const edited = await call(`/api/admin/notices/${cse.body.data._id}`, users[0], { method: 'PATCH', body: JSON.stringify({ title: `${marker} CSE placement edited` }) });
    assert.equal(edited.status, 200); assert.equal(edited.body.data.publishedAt, originalPublishedAt);
    assert.equal((await call(`/api/admin/notices/${cse.body.data._id}`, users[0])).status, 200);
    const adminFiltered = await call(`/api/admin/notices?status=published&category=placement&search=${marker}`, users[0]);
    assert.equal(adminFiltered.body.data.some((item) => item._id === cse.body.data._id), true);
    assert.equal(adminFiltered.body.programs.some((program) => program.programCode === 'CSE'), true);
    assert.equal((await call('/api/notices', users[1])).body.data.some((item) => item.id === cse.body.data._id), true);
    assert.equal((await call('/api/notices', users[3])).body.data.some((item) => item.id === cse.body.data._id), false);
    assert.equal((await call(`/api/notices/${cse.body.data._id}`, users[3])).status, 404);
    assert.equal((await call('/api/notices?program=CSE', users[3])).status, 400);

    const cse7 = await create({ title: `${marker} CSE7 exam`, content: 'semester seven', category: 'examination', priority: 'urgent', targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: 7, attachmentUrl: 'https://fixtures.invalid/exam.pdf' });
    await publish(cse7.body.data._id);
    assert.equal((await call('/api/notices', users[1])).body.data.some((item) => item.id === cse7.body.data._id), true);
    assert.equal((await call('/api/notices', users[2])).body.data.some((item) => item.id === cse7.body.data._id), false);

    assert.equal((await create({ title: 'bad', content: 'bad', targetScope: 'program', targetPrograms: ['UNKNOWN'] })).status, 400);
    assert.equal((await create({ title: 'bad', content: 'bad', targetScope: 'semester', targetPrograms: ['CSE'], targetSemester: 9 })).status, 400);
    assert.equal((await create({ title: 'bad', content: 'bad', attachmentUrl: 'javascript:alert(1)' })).status, 400);
    assert.equal((await call('/api/admin/notices/not-an-id', users[0])).status, 400);

    const expired = await Notice.create({ title: `${marker} expired`, content: 'expired', status: 'published', publishedAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() - 1000), targetScope: 'college', createdBy: users[0]._id, updatedBy: users[0]._id });
    assert.equal((await call('/api/notices', users[1])).body.data.some((item) => item.id === expired._id.toString()), false);

    const search = await call('/api/notices?search=searchable%20phrase&limit=1&page=1', users[1]);
    assert.equal(search.status, 200); assert.equal(search.body.data.length, 1); assert.equal(search.body.pagination.limit, 1);

    const archived = await call(`/api/admin/notices/${college.body.data._id}/archive`, users[0], { method: 'POST', body: '{}' });
    assert.equal(archived.body.data.status, 'archived');
    assert.equal((await call('/api/notices', users[1])).body.data.some((item) => item.id === college.body.data._id), false);
    const republished = await publish(college.body.data._id); assert.equal(republished.body.data.status, 'published'); assert.ok(republished.body.data.publishedAt);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await Notice.deleteMany({ title: { $regex: marker } });
    await User.deleteMany({ email: { $regex: marker } });
    await mongoose.disconnect();
  }
});
