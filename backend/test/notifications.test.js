import assert from 'node:assert/strict';
import test from 'node:test';
import Notification from '../models/Notification.js';
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead, parsePagination } from '../controllers/notificationController.js';
import { createNotification } from '../services/notificationService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const userId = '507f1f77bcf86cd799439011';
const otherUserId = '507f1f77bcf86cd799439012';
const notificationId = '507f1f77bcf86cd799439013';
const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { resolve({ status: this.statusCode, payload }); } };
  handler(req, res, reject);
});

test('notification pagination is bounded and rejects malformed values', () => {
  assert.deepEqual(parsePagination({ page: '2', limit: '10' }), { page: 2, limit: 10, skip: 10 });
  assert.throws(() => parsePagination({ page: '0' }), /positive integer/i);
  assert.throws(() => parsePagination({ limit: '51' }), /between 1 and 50/i);
  assert.throws(() => parsePagination({ limit: '1.5' }), /between 1 and 50/i);
});

test('retrieval is recipient-scoped, stable, minimal, and paginated', async () => {
  const originals = { find: Notification.find, count: Notification.countDocuments };
  let filter; let sort; let selected;
  try {
    Notification.find = (value) => {
      filter = value;
      return { select(valueToSelect) { selected = valueToSelect; return this; }, sort(valueToSort) { sort = valueToSort; return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [{ _id: notificationId }] };
    };
    Notification.countDocuments = async (value) => { assert.deepEqual(value, { user: userId }); return 21; };
    const result = await invoke(getNotifications, { user: { userId }, query: { page: '2', limit: '20' } });
    assert.deepEqual(filter, { user: userId });
    assert.deepEqual(sort, { createdAt: -1, _id: -1 });
    assert.match(selected, /metadata/);
    assert.deepEqual(result.payload.pagination, { page: 2, limit: 20, total: 21, totalPages: 2 });
  } finally { Notification.find = originals.find; Notification.countDocuments = originals.count; }
});

test('unread count and mark-all only query the authenticated recipient', async () => {
  const originals = { count: Notification.countDocuments, updateMany: Notification.updateMany };
  try {
    Notification.countDocuments = async (filter) => { assert.deepEqual(filter, { user: userId, isRead: { $ne: true } }); return 3; };
    assert.equal((await invoke(getUnreadCount, { user: { userId } })).payload.unreadCount, 3);
    Notification.updateMany = async (filter, update) => { assert.deepEqual(filter, { user: userId, isRead: { $ne: true } }); assert.deepEqual(update, { $set: { isRead: true } }); return { modifiedCount: 3 }; };
    assert.equal((await invoke(markAllNotificationsRead, { user: { userId } })).payload.modifiedCount, 3);
  } finally { Notification.countDocuments = originals.count; Notification.updateMany = originals.updateMany; }
});

test('mark-one enforces ownership, validates IDs, and remains idempotent', async () => {
  const original = Notification.findOneAndUpdate;
  try {
    let calls = 0;
    Notification.findOneAndUpdate = (filter, update) => ({ select: async () => { calls += 1; assert.deepEqual(filter, { _id: notificationId, user: userId }); assert.deepEqual(update, { $set: { isRead: true } }); return { _id: notificationId, isRead: true }; } });
    assert.equal((await invoke(markNotificationRead, { params: { id: notificationId }, user: { userId } })).payload.data.isRead, true);
    assert.equal((await invoke(markNotificationRead, { params: { id: notificationId }, user: { userId } })).payload.data.isRead, true);
    assert.equal(calls, 2);
    await assert.rejects(invoke(markNotificationRead, { params: { id: 'bad' }, user: { userId } }), /invalid notification id/i);
    Notification.findOneAndUpdate = () => ({ select: async () => null });
    assert.equal((await invoke(markNotificationRead, { params: { id: notificationId }, user: { userId: otherUserId } })).status, 404);
  } finally { Notification.findOneAndUpdate = original; }
});

test('notification is persisted before delivery and targets only the server recipient room', async () => {
  const original = Notification.create;
  const events = [];
  try {
    Notification.create = async (data) => ({ ...data, _id: notificationId, isRead: false, createdAt: new Date(), toObject() { return { ...this, toObject: undefined }; } });
    const io = { to(room) { events.push(['room', room]); return { emit(name, payload) { events.push(['emit', name, payload._id]); } }; } };
    await createNotification(io, { user: userId, type: 'connection', title: 'Request', body: 'Body' });
    assert.deepEqual(events[0], ['room', `user:${userId}`]);
    assert.deepEqual(events[1], ['emit', 'notification:new', notificationId]);
  } finally { Notification.create = original; }
});

test('notification routes require authentication', async () => {
  await new Promise((resolve) => authMiddleware({ headers: {} }, {}, (error) => { assert.equal(error.status, 401); resolve(); }));
});
