import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import mongoose from 'mongoose';
import { prepareFreshDeploymentIndexes, verifyDeploymentIndexes } from '../config/deploymentIndexes.js';
import { requestMetaMiddleware } from '../middleware/requestMiddleware.js';

test('request logs use route templates and exclude URL parameters, credentials and session data', (context) => {
  const log = context.mock.method(console, 'log');
  const response = Object.assign(new EventEmitter(), { statusCode: 200, setHeader() {} });
  const request = {
    method: 'POST',
    originalUrl: '/private/secret-path?reset=secret-reset',
    headers: { cookie: 'secret-cookie', authorization: 'secret-authorization' },
    route: { path: '/:id' }
  };
  requestMetaMiddleware(request, response, () => response.emit('finish'));
  assert.equal(log.mock.calls.length, 1);
  assert.match(log.mock.calls[0].arguments[0], /POST \/:id 200/);
  assert.doesNotMatch(log.mock.calls[0].arguments[0], /secret-/);
});

const uri = process.env.DEPLOYMENT_INDEX_TEST_MONGO_URI;
test('deployment provisioning requires a fresh target, verifies all options, and is idempotent', { skip: !uri }, async () => {
  assert.equal(uri, 'mongodb://127.0.0.1:27019/campusswap_demo', 'Use the disposable MongoDB listener');
  const client = await new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  const suffix = randomUUID().replaceAll('-', '');
  try {
    const database = client.db('campusswap_demo_' + suffix);
    await assert.rejects(verifyDeploymentIndexes(database), /Missing required deployment indexes/);
    assert.ok(await prepareFreshDeploymentIndexes(database) >= 49);
    assert.equal(await prepareFreshDeploymentIndexes(database), 0);
    const otp = database.collection('emailverifications');
    const indexes = await otp.listIndexes().toArray();
    assert.deepEqual(indexes.find(({ name }) => name === 'email_1_kind_1').key, { email: 1, kind: 1 });
    assert.equal(indexes.find(({ name }) => name === 'email_1_kind_1').unique, true);
    assert.equal(indexes.find(({ name }) => name === 'expiresAt_1').expireAfterSeconds, 0);
    await otp.insertOne({ email: 'fixture@demo.invalid', kind: 'registration' });
    await assert.rejects(otp.insertOne({ email: 'fixture@demo.invalid', kind: 'registration' }), { code: 11000 });
    assert.equal(await prepareFreshDeploymentIndexes(database), 0);

    const conflicting = client.db('campusswap_demo_conflict' + suffix);
    const wrongOtp = conflicting.collection('emailverifications');
    await wrongOtp.createIndex({ email: 1, kind: 1 });
    await assert.rejects(prepareFreshDeploymentIndexes(conflicting), /Conflicting index definition/);
    assert.equal(await conflicting.listCollections().toArray().then((items) => items.length), 1);

    const conflictingText = client.db('campusswap_demo_text' + suffix);
    await conflictingText.collection('listings').createIndex(
      { category: 1, title: 'text', description: 'text', tags: 'text' },
      { name: 'title_text_description_text_tags_text' }
    );
    await assert.rejects(prepareFreshDeploymentIndexes(conflictingText), /Conflicting index definition/);

    const populated = client.db('campusswap_demo_populated' + suffix);
    const duplicate = { email: 'fixture@demo.invalid', kind: 'registration' };
    await populated.collection('emailverifications').insertMany([duplicate, { ...duplicate, _id: new mongoose.Types.ObjectId() }]);
    await assert.rejects(prepareFreshDeploymentIndexes(populated), /populated deployment database/);
    assert.equal(await populated.collection('emailverifications').countDocuments(), 2);
    await assert.rejects(prepareFreshDeploymentIndexes(client.db('campusswap')), /outside a named deployment database/);
  } finally {
    await client.close();
  }
});
