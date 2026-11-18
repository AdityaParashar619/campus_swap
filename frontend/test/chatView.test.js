import test from 'node:test';
import assert from 'node:assert/strict';
import { appendUniqueMessage, filterConversations, formatConversationTime, formatMessageDate, isNearScrollBottom, mergeConversationSummaries, shouldShowDateSeparator, updateConversationActivity } from '../src/utils/chatView.js';

test('conversation summaries merge, order by latest activity, and preserve users without messages', () => {
  const users = [{ _id: 'a', name: 'Asha' }, { _id: 'b', name: 'Bharat' }, { _id: 'c', name: 'Chetan' }];
  const summaries = [{ participantId: 'a', lastMessage: { text: 'older', createdAt: '2026-01-01T10:00:00Z' } }, { participantId: 'b', lastMessage: { text: 'newer', createdAt: '2026-01-02T10:00:00Z' } }];
  assert.deepEqual(mergeConversationSummaries(users, summaries).map((item) => item._id), ['b', 'a', 'c']);
});

test('conversation search matches participant and preview text', () => {
  const users = [{ name: 'Asha', lastMessage: { text: 'Calculator available' } }, { name: 'Bharat', lastMessage: null }];
  assert.equal(filterConversations(users, 'calculator').length, 1);
  assert.equal(filterConversations(users, 'bhar').length, 1);
});

test('timestamps and date separators provide stable presentation labels', () => {
  const now = new Date('2026-11-17T12:00:00');
  assert.match(formatConversationTime('2026-11-17T10:00:00', now), /10:00/);
  assert.equal(formatMessageDate('2026-11-17T08:00:00', now), 'Today');
  assert.equal(formatMessageDate('2026-11-16T08:00:00', now), 'Yesterday');
  const messages = [{ createdAt: '2026-11-16T10:00:00Z' }, { createdAt: '2026-11-17T10:00:00Z' }];
  assert.equal(shouldShowDateSeparator(messages, 0), true);
  assert.equal(shouldShowDateSeparator(messages, 1), true);
});

test('duplicate messages are ignored and scroll proximity is bounded', () => {
  const current = [{ _id: '1', createdAt: '2026-01-01T00:00:00Z' }];
  assert.equal(appendUniqueMessage(current, current[0]), current);
  assert.equal(appendUniqueMessage(current, { _id: '2', createdAt: '2026-01-02T00:00:00Z' }).length, 2);
  assert.equal(isNearScrollBottom({ scrollHeight: 1000, scrollTop: 800, clientHeight: 150 }), true);
  assert.equal(isNearScrollBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 150 }), false);
});

test('real-time activity updates the matching conversation without exposing or dropping other users', () => {
  const users = [{ _id: 'a', name: 'Asha', lastMessage: null }, { _id: 'b', name: 'Bharat', lastMessage: null }];
  const updated = updateConversationActivity(users, 'b', { text: 'Newest', createdAt: '2026-11-17T12:00:00Z' });
  assert.deepEqual(updated.map((item) => item._id), ['b', 'a']);
  assert.equal(updated[0].lastMessage.text, 'Newest');
  assert.equal(updated[1], users[0]);
});
