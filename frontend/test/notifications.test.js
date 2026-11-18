import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReadState, formatUnreadCount, getNotificationAction, mergeNotifications } from '../src/utils/notifications.js';

const firstId = '507f1f77bcf86cd799439011';
const secondId = '507f1f77bcf86cd799439012';

test('unread badge is bounded and defensive', () => {
  assert.equal(formatUnreadCount(0), '0'); assert.equal(formatUnreadCount(12), '12'); assert.equal(formatUnreadCount(100), '99+'); assert.equal(formatUnreadCount(-2), '0');
});

test('notifications merge without duplicate IDs and sort newest first', () => {
  const merged = mergeNotifications(
    [{ _id: firstId, title: 'old', createdAt: '2026-01-01T00:00:00Z', isRead: false }],
    [{ _id: firstId, title: 'updated', createdAt: '2026-01-01T00:00:00Z', isRead: true }, { _id: secondId, createdAt: '2026-01-02T00:00:00Z' }]
  );
  assert.deepEqual(merged.map((item) => item._id), [secondId, firstId]);
  assert.equal(merged[1].title, 'updated'); assert.equal(merged[1].isRead, true);
});

test('read state update is immutable and scoped', () => {
  const items = [{ _id: firstId, isRead: false }, { _id: secondId, isRead: false }];
  const updated = applyReadState(items, firstId);
  assert.equal(items[0].isRead, false); assert.equal(updated[0].isRead, true); assert.equal(updated[1].isRead, false);
});

test('navigation uses authoritative identifiers and safe fallbacks', () => {
  assert.deepEqual(getNotificationAction({ type: 'message', metadata: { senderId: firstId } }), { label: 'Open chat', to: '/chat', state: { selectedUserId: firstId } });
  assert.equal(getNotificationAction({ type: 'message', metadata: { senderId: 'https://evil.test' } }).to, '/dashboard');
  assert.equal(getNotificationAction({ type: 'connection', metadata: {} }).to, '/network');
  assert.equal(getNotificationAction({ type: 'request', metadata: { requestId: firstId } }).to, '/bounties');
  assert.equal(getNotificationAction({ type: 'listing', metadata: { listingId: secondId } }).to, `/listings/${secondId}`);
});
