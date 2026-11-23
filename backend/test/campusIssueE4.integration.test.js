import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { mockIssueCloudinary } from '../test-support/campusIssueCloudinaryMock.js';

const uri = process.env.CAMPUS_ISSUE_E4_TEST_MONGO_URI;
const db = 'campusswap_e4_integration_test';
const prefix = 'campusswap/campus-issues/evidence/';

test('Campus Issues evidence, History and deletion use private ownership and recoverable cleanup', { skip: !uri, timeout: 60_000 }, async (t) => {
  assert.equal(uri, `mongodb://127.0.0.1:27019/${db}`, 'Use only the disposable E4 test database');
  Object.assign(process.env, {
    NODE_ENV: 'test', JWT_SECRET: 'isolated-issue-e4-integration-token-key',
    CLOUDINARY_CLOUD_NAME: 'campusswap-e4-mock', CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-secret',
    CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED: 'true', CAMPUS_ISSUE_TEST_DELETE_ENABLED: 'true',
    CAMPUS_ISSUE_TEST_DATABASE: db
  });
  const [{ createApp }, { signAuthToken }, { default: User }, { default: CampusIssue }, { recoverAbandonedIssue }] = await Promise.all([
    import('../app.js'), import('../utils/auth.js'), import('../models/User.js'), import('../models/CampusIssue.js'),
    import('../services/campusIssueLifecycle.js')
  ]);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  const provider = mockIssueCloudinary();
  const users = [];
  let server;
  try {
    for (const role of ['student', 'student', 'admin']) {
      users.push(await User.create({
        name: 'Synthetic verification user', email: `${randomUUID()}@satiengg.in`, role,
        password: 'unused-test-hash', emailVerified: true, verificationStatus: 'verified', accountStatus: 'active'
      }));
    }
    const [owner, other, admin] = users;
    await new Promise((resolve, reject) => {
      server = createApp().listen(0, '127.0.0.1', resolve).once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const student = '/api/campus-issues';
    const management = '/api/admin/campus-issues';
    const fixture = { title: 'E4 synthetic report', category: 'water', description: 'Synthetic photo evidence.' };
    async function call(path, { user = owner, method = 'GET', payload, version } = {}) {
      const headers = {};
      if (user) headers.Authorization = `Bearer ${signAuthToken({ userId: String(user._id), tokenVersion: 0 })}`;
      if (version !== undefined) headers['If-Match'] = `"${version}"`;
      const multipart = payload instanceof FormData;
      if (payload && !multipart) headers['Content-Type'] = 'application/json';
      const response = await fetch(base + path, { method, headers, body: multipart ? payload : JSON.stringify(payload) });
      const body = response.headers.get('content-type')?.includes('json')
        ? await response.json() : Buffer.from(await response.arrayBuffer());
      return { status: response.status, headers: response.headers, body };
    }
    function form(files, key = randomUUID(), input = fixture) {
      const data = new FormData();
      data.set('issue', JSON.stringify(input));
      data.set('submissionKey', key);
      for (const [buffer, type] of files) data.append('photos', new Blob([buffer], { type }), 'private-source.jpg');
      return data;
    }
    const inputs = await Promise.all(['jpeg', 'png', 'webp'].map(async (format) => [
      await sharp({ create: { width: 7, height: 5, channels: 3, background: '#aa0667' } }).toFormat(format).toBuffer(),
      `image/${format}`
    ]));
    let issue;
    await t.test('validated multipart submissions are idempotent and evidence is privately streamed', async () => {
      const upload = (payload, user = owner) => call(student, { user, method: 'POST', payload });
      assert.equal((await upload(form(inputs), null)).status, 401);
      assert.equal((await upload(form([...inputs, inputs[0]]))).status, 400);
      assert.equal((await upload(form([[Buffer.alloc(5 * 1024 * 1024 + 1), 'image/jpeg']]))).status, 400);
      assert.equal((await upload(form([[inputs[0][0], 'image/png']]))).status, 400);
      assert.equal((await upload(form(inputs, undefined, { ...fixture, testFixture: true }))).status, 400);
      assert.equal((await upload(form([], undefined, { ...fixture, attachments: ['forged'] }))).status, 400);
      const key = randomUUID();
      const replies = await Promise.all([upload(form(inputs, key)), upload(form(inputs, key))]);
      assert.ok(replies.some(({ status }) => status === 201));
      assert.ok(replies.every(({ status }) => [200, 201, 409].includes(status)));
      issue = replies.find(({ status }) => status === 201).body.data;
      const replay = await upload(form(inputs, key));
      assert.equal(replay.status, 200);
      assert.equal(replay.body.data.id, issue.id);
      assert.equal(await CampusIssue.countDocuments({ createdBy: owner._id, submissionKey: key }), 1);
      assert.equal(provider.assets.size, 3);
      assert.equal(issue.evidence.length, 3);
      assert.deepEqual(Object.keys(issue.evidence[0]), ['id']);
      assert.doesNotMatch(JSON.stringify(issue), /cloudinary|api_key|signature|private-source/i);
      const photoId = issue.evidence[0].id;
      assert.equal(provider.assets.has(`${prefix}${issue.id}/${photoId}`), false);
      const evidence = `${student}/${issue.id}/evidence/${photoId}`;
      assert.equal((await call(evidence, { user: null })).status, 401);
      assert.equal((await call(evidence, { user: other })).status, 404);
      assert.equal((await call(evidence.replace(photoId, other.id))).status, 404);
      assert.equal((await call(`${management}/${issue.id}/evidence/${photoId}`, { user: other })).status, 403);
      const allowed = await call(evidence);
      assert.equal(allowed.status, 200);
      assert.equal(allowed.headers.get('cache-control'), 'no-store');
      assert.equal(allowed.headers.get('content-type'), 'image/webp');
      assert.equal(allowed.headers.get('location'), null);
      assert.equal((await sharp(allowed.body).metadata()).format, 'webp');
      assert.equal((await call(`${management}/${issue.id}/evidence/${photoId}`, { user: admin })).status, 200);
      assert.equal((await call(`${student}/${issue.id}`, { user: other })).status, 404);
    });

    await t.test('old report filtering precedes pagination and historical evidence stays available', async () => {
      const day = 86_400_000;
      const now = Date.now();
      const recent = new Date(now - 6 * day);
      const past = new Date(now - 8 * day);
      await CampusIssue.updateOne({ _id: issue.id }, { $set: { status: 'resolved', resolvedAt: past } });
      const specimens = {
        submitted: {}, reviewing: { status: 'under_review' }, legacy: { status: 'closed' },
        recentResolved: { status: 'resolved', resolvedAt: recent }, recentClosed: { status: 'closed', closedAt: recent },
        oldClosed: { status: 'closed', closedAt: past }, boundary: { status: 'closed', closedAt: new Date(now - 7 * day) }
      };
      for (const [title, fields] of Object.entries(specimens)) {
        await CampusIssue.create({ ...fixture, title, createdBy: owner._id, ...fields });
      }
      const recentReports = await call(`${student}/mine`);
      assert.deepEqual(recentReports.body.data.map(({ title }) => title).sort(),
        ['legacy', 'recentClosed', 'recentResolved', 'reviewing', 'submitted']);
      const history = await call(`${student}/mine?view=history&limit=1&page=2`);
      assert.equal(history.body.pagination.total, 3);
      assert.equal(history.body.data.length, 1);
      assert.equal((await call(`${student}/mine?view=history&status=resolved&category=water&search=E4`)).body.data[0].id, issue.id);
      assert.equal((await call(`${student}/mine?view=history`, { user: other })).body.pagination.total, 0);
      assert.equal((await call(`${student}/${issue.id}`)).status, 200);
      assert.equal((await call(`${student}/${issue.id}/evidence/${issue.evidence[0].id}`)).status, 200);
      assert.equal((await call(`${management}/${issue.id}`, { user: admin })).status, 200);
      assert.equal(await CampusIssue.countDocuments({ createdBy: owner._id }), 8);
    });

    await t.test('partial upload is invisible, compensation is scoped, and delayed recovery is idempotent', async () => {
      provider.failUpload = provider.uploadAttempts + 2;
      const key = randomUUID();
      const failed = await call(student, { method: 'POST', payload: form(inputs, key, { ...fixture, title: 'Failed photo fixture' }) });
      assert.equal(failed.status, 503);
      const stage = await CampusIssue.findOne({ createdBy: owner._id, title: 'Failed photo fixture' })
        .select('+evidenceStage +attachments +submissionKey');
      assert.equal(stage.evidenceStage, 'abandoned');
      assert.equal(stage.submissionKey, undefined);
      assert.equal((await call(`${student}/${stage.id}`)).status, 404);
      assert.equal((await call(`${management}/${stage.id}`, { user: admin })).status, 404);
      assert.equal(provider.assets.size, 4);
      await assert.rejects(recoverAbandonedIssue(stage.id), { status: 404 });
      const future = new Date(Date.now() + 3_700_000);
      await recoverAbandonedIssue(stage.id, future);
      await assert.rejects(recoverAbandonedIssue(stage.id, future), { status: 404 });
      assert.equal(provider.assets.size, 3);
      assert.equal(await CampusIssue.exists({ _id: stage.id }), null);
      assert.equal((await call(student, { method: 'POST', payload: form([], key) })).status, 201);

      const update = CampusIssue.findOneAndUpdate;
      CampusIssue.findOneAndUpdate = function (filter, ...rest) {
        const query = update.call(this, filter, ...rest);
        if (filter.evidenceStage !== 'uploading') return query;
        const select = query.select.bind(query);
        query.select = async (...fields) => {
          await select(...fields);
          throw new Error('Simulated lost MongoDB publish acknowledgement');
        };
        return query;
      };
      const retryKey = randomUUID();
      try {
        const lost = await call(student, { method: 'POST', payload: form([inputs[0]], retryKey) });
        assert.equal(lost.status, 500);
      } finally { CampusIssue.findOneAndUpdate = update; }
      const recovered = await call(student, { method: 'POST', payload: form([inputs[0]], retryKey) });
      assert.equal(recovered.status, 200);
      const saved = recovered.body.data;
      assert.equal((await call(`${student}/${saved.id}/evidence/${saved.evidence[0].id}`)).status, 200);
      assert.equal(await CampusIssue.countDocuments({ createdBy: owner._id, submissionKey: retryKey }), 1);
    });

    await t.test('only confirmed marked test deletion is allowed, and failed removals keep a retry record', async () => {
      const evidenceId = new mongoose.Types.ObjectId();
      const storageKey = new mongoose.Types.ObjectId();
      const marked = await CampusIssue.create({
        ...fixture, title: 'Approved synthetic cleanup fixture', createdBy: owner._id, testFixture: true,
        evidenceCloud: 'campusswap-e4-mock', attachments: [{
          evidenceId, storageKey, mediaType: 'image/webp', sizeBytes: inputs[2][0].length, uploadedAt: new Date()
        }]
      });
      const asset = `${prefix}${marked.id}/${storageKey}`;
      provider.assets.set(asset, inputs[2][0]);
      for (const assetType of ['products', 'avatars', 'notes', 'notices']) provider.assets.set(`campusswap/${assetType}/preserved`, inputs[2][0]);
      const deleteAt = (id, { version = 0, user = admin, confirmation = 'DELETE' } = {}) =>
        call(`${management}/${id}/test-report`, { user, version, method: 'DELETE', payload: { confirmation } });
      assert.equal((await deleteAt(marked.id, { user: owner })).status, 403);
      assert.equal((await deleteAt(marked.id, { user: null })).status, 401);
      assert.equal((await call(`${student}/${marked.id}`, { method: 'DELETE' })).status, 404);
      assert.equal((await call(management, { user: admin, method: 'DELETE' })).status, 404);
      assert.equal((await deleteAt(issue.id)).status, 403);
      const unmarked = await CampusIssue.create({ ...fixture, title: 'test demo sample', createdBy: owner._id });
      assert.equal((await deleteAt(unmarked.id)).status, 403);
      assert.equal((await deleteAt(marked.id, { confirmation: 'delete' })).status, 400);
      assert.equal((await deleteAt(marked.id, { version: 10 })).status, 409);
      process.env.NODE_ENV = 'production';
      try { assert.equal((await deleteAt(marked.id)).status, 403); } finally { process.env.NODE_ENV = 'test'; }
      process.env.CAMPUS_ISSUE_TEST_DATABASE = 'campusswap_wrong_test';
      try { assert.equal((await deleteAt(marked.id)).status, 403); } finally { process.env.CAMPUS_ISSUE_TEST_DATABASE = db; }

      provider.failDestroy = true;
      try { assert.equal((await deleteAt(marked.id)).status, 503); } finally { provider.failDestroy = false; }
      const pending = (await call(`${management}/${marked.id}`, { user: admin })).body.data;
      assert.equal(pending.cleanupPending, true);
      assert.equal(pending.canDeleteTestReport, true);
      assert.deepEqual(pending.evidence, []);
      assert.equal((await call(`${student}/${marked.id}`)).status, 404);
      assert.equal((await call(`${management}/${marked.id}/evidence/${evidenceId}`, { user: admin })).status, 404);
      assert.equal((await deleteAt(marked.id)).status, 409);
      const deleteOne = CampusIssue.deleteOne;
      CampusIssue.deleteOne = () => { throw new Error('Simulated MongoDB deletion failure'); };
      try { assert.equal((await deleteAt(marked.id, { version: pending.version })).status, 503); }
      finally { CampusIssue.deleteOne = deleteOne; }
      assert.equal(provider.assets.has(asset), false);
      assert.ok(await CampusIssue.exists({ _id: marked.id }));
      const retried = await Promise.all([
        deleteAt(marked.id, { version: pending.version }), deleteAt(marked.id, { version: pending.version })
      ]);
      assert.deepEqual(retried.map(({ status }) => status).sort(), [200, 404]);
      assert.equal((await deleteAt(marked.id, { version: pending.version })).status, 404);
      assert.equal(await CampusIssue.exists({ _id: marked.id }), null);
      assert.ok(await CampusIssue.exists({ _id: unmarked.id }));
      assert.ok(await CampusIssue.exists({ _id: issue.id }));
      assert.equal(provider.assets.size, 8);
      assert.ok(provider.destroyed.every((id) => id.startsWith(prefix) && !id.includes(issue.id)));
    });
  } finally {
    provider.restore();
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      await CampusIssue.deleteMany({ createdBy: { $in: users.map((user) => user._id) } });
      await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
    } finally {
      await mongoose.disconnect();
    }
  }
});
