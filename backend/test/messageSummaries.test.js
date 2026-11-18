import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversationSummaries } from '../controllers/messageController.js';
import Message from '../models/Message.js';
import { buildConversationSummaryPipeline, parseSummaryPagination } from '../utils/messageSummaries.js';

test('conversation summary pagination is bounded and rejects excessive ranges by clamping', () => {
  assert.deepEqual(parseSummaryPagination({ page: '-2', limit: '9999' }), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(parseSummaryPagination({ page: '3', limit: '20' }), { page: 3, limit: 20, skip: 40 });
});

test('conversation summary pipeline scopes messages to the authenticated user and returns no participant profile data', () => {
  const userId = '507f1f77bcf86cd799439011';
  const pipeline = buildConversationSummaryPipeline(userId, { skip: 0, limit: 25 });
  const serialized = JSON.stringify(pipeline);
  assert.match(serialized, /"sender":"507f1f77bcf86cd799439011"/);
  assert.match(serialized, /"receiver":"507f1f77bcf86cd799439011"/);
  assert.doesNotMatch(serialized, /email|phone|profilePicture|name/);
  assert.deepEqual(pipeline.at(-1).$facet.data[1], { $limit: 25 });
});

test('conversation summaries select the latest message and sort conversations by its timestamp', () => {
  const pipeline = buildConversationSummaryPipeline('507f1f77bcf86cd799439011', { skip: 0, limit: 50 });
  assert.deepEqual(pipeline[1], { $sort: { createdAt: -1, _id: -1 } });
  assert.deepEqual(pipeline[3].$group.lastMessage, { $first: { text: '$text', createdAt: '$createdAt' } });
  assert.deepEqual(pipeline[4], { $sort: { 'lastMessage.createdAt': -1, _id: 1 } });
});

test('authenticated summary controller returns bounded pagination and no unrelated response data', async () => {
  const originalAggregate = Message.aggregate;
  let receivedPipeline;
  Message.aggregate = async (pipeline) => {
    receivedPipeline = pipeline;
    return [{ data: [{ participantId: '507f1f77bcf86cd799439012', lastMessage: { text: 'Hello', createdAt: new Date('2026-11-17T10:00:00Z') } }], metadata: [{ total: 1 }] }];
  };
  const req = { user: { userId: '507f1f77bcf86cd799439011' }, query: { limit: '999' } };
  const response = { payload: null, json(payload) { this.payload = payload; } };
  let nextError;
  try {
    getConversationSummaries(req, response, (error) => { nextError = error; });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    Message.aggregate = originalAggregate;
  }
  assert.equal(nextError, undefined);
  assert.equal(response.payload.success, true);
  assert.deepEqual(response.payload.pagination, { page: 1, limit: 100, total: 1, totalPages: 1 });
  assert.equal(receivedPipeline.at(-1).$facet.data[1].$limit, 100);
  assert.deepEqual(Object.keys(response.payload.data[0]).sort(), ['lastMessage', 'participantId']);
});
