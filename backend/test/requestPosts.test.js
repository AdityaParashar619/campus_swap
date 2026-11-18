import test from 'node:test';
import assert from 'node:assert/strict';
import RequestPost from '../models/RequestPost.js';
import { createRequestPost, getRequestPosts, updateRequestPostStatus } from '../controllers/requestController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const ownerId = '507f1f77bcf86cd799439011';
const requestId = '507f1f77bcf86cd799439012';

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { resolve({ status: this.statusCode, payload }); } };
  handler(req, res, reject);
});

test('valid creation normalizes fields and derives ownership from authentication', async () => {
  const originalCreate = RequestPost.create;
  let created;
  try {
    RequestPost.create = async (value) => { created = value; return value; };
    const result = await invoke(createRequestPost, { user: { userId: ownerId }, body: { title: '  Need notes  ', description: '  Tomorrow  ', category: 'notes', location: ' Library ', user: 'attacker' } });
    assert.fail('protected owner field should have been rejected');
  } catch (error) {
    assert.match(error.message, /unsupported request field/i);
    const result = await invoke(createRequestPost, { user: { userId: ownerId }, body: { title: '  Need notes  ', description: '  Tomorrow  ', category: 'notes', location: ' Library ' } });
    assert.equal(result.status, 201);
    assert.equal(created.user, ownerId);
    assert.equal(created.title, 'Need notes');
    assert.equal(created.category, 'Notes');
  } finally { RequestPost.create = originalCreate; }
});

test('public request feed is always open-only and retains pagination response compatibility', async () => {
  const originalFind = RequestPost.find;
  const originalCount = RequestPost.countDocuments;
  let findFilter;
  let countFilter;
  try {
    RequestPost.find = (filter) => {
      findFilter = filter;
      const chain = { populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] };
      return chain;
    };
    RequestPost.countDocuments = async (filter) => { countFilter = filter; return 0; };
    const result = await invoke(getRequestPosts, { query: { status: 'closed', page: '2', limit: '5' } });
    assert.deepEqual(findFilter, { status: 'open' });
    assert.deepEqual(countFilter, { status: 'open' });
    assert.deepEqual(result.payload.pagination, { page: 2, limit: 5, total: 0, totalPages: 0 });
  } finally { RequestPost.find = originalFind; RequestPost.countDocuments = originalCount; }
});

test('owner closure is atomic, preserves the document, and duplicate closure is idempotent', async () => {
  const originalUpdate = RequestPost.findOneAndUpdate;
  const originalFind = RequestPost.findById;
  let updateQuery;
  const closedDocument = { _id: requestId, user: { toString: () => ownerId }, status: 'closed' };
  try {
    RequestPost.findOneAndUpdate = async (query) => { updateQuery = query; return closedDocument; };
    RequestPost.findById = () => ({ populate() { return this; }, then(resolve) { resolve(closedDocument); } });
    const first = await invoke(updateRequestPostStatus, { params: { id: requestId }, body: { status: 'closed' }, user: { userId: ownerId } });
    assert.deepEqual(updateQuery, { _id: requestId, user: ownerId, status: 'open' });
    assert.equal(first.payload.data.status, 'closed');

    RequestPost.findOneAndUpdate = async () => null;
    const duplicate = await invoke(updateRequestPostStatus, { params: { id: requestId }, body: { status: 'closed' }, user: { userId: ownerId } });
    assert.equal(duplicate.payload.message, 'Request closed');
  } finally { RequestPost.findOneAndUpdate = originalUpdate; RequestPost.findById = originalFind; }
});

test('malformed IDs and unauthorized closure are rejected', async () => {
  await assert.rejects(invoke(updateRequestPostStatus, { params: { id: 'bad' }, body: { status: 'closed' }, user: { userId: ownerId } }), /invalid request id/i);
  const originalUpdate = RequestPost.findOneAndUpdate;
  const originalFind = RequestPost.findById;
  try {
    RequestPost.findOneAndUpdate = async () => null;
    RequestPost.findById = async () => ({ user: { toString: () => 'another-user' }, status: 'open' });
    await assert.rejects(invoke(updateRequestPostStatus, { params: { id: requestId }, body: { status: 'closed' }, user: { userId: ownerId } }), /not authorized/i);
  } finally { RequestPost.findOneAndUpdate = originalUpdate; RequestPost.findById = originalFind; }
});

test('request mutations remain protected from unauthenticated users', async () => {
  await new Promise((resolve) => authMiddleware({ headers: {} }, {}, (error) => { assert.equal(error.status, 401); resolve(); }));
});
