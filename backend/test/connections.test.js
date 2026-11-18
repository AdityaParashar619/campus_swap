import test from 'node:test';
import assert from 'node:assert/strict';
import Connection from '../models/Connection.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { getStudentRelationship, respondToConnectionRequest, sendConnectionRequest } from '../controllers/connectionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const requesterId = '507f1f77bcf86cd799439011';
const recipientId = '507f1f77bcf86cd799439012';

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ status: this.statusCode, payload }); }
  };
  handler(req, res, reject);
});

test('valid request uses a direction-independent identifier and creates one notification', async () => {
  const originals = { exists: User.exists, findOne: Connection.findOne, create: Connection.create, notify: Notification.create };
  const notifications = [];
  try {
    User.exists = async () => true;
    Connection.findOne = async () => null;
    Connection.create = async (value) => ({ ...value, status: 'pending' });
    Notification.create = async (value) => { notifications.push(value); };
    const result = await invoke(sendConnectionRequest, { body: { recipientId }, user: { userId: requesterId } });
    assert.equal(result.status, 201);
    assert.equal(String(result.payload.data._id).length, 24);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].user, recipientId);
  } finally { User.exists = originals.exists; Connection.findOne = originals.findOne; Connection.create = originals.create; Notification.create = originals.notify; }
});

test('self and malformed connection requests are rejected before writes', async () => {
  await assert.rejects(invoke(sendConnectionRequest, { body: { recipientId: requesterId }, user: { userId: requesterId } }), /yourself/i);
  await assert.rejects(invoke(sendConnectionRequest, { body: { recipientId: 'bad' }, user: { userId: requesterId } }), /invalid recipient/i);
});

test('duplicate and concurrent requests remain a single relationship and notification', async () => {
  const originals = { exists: User.exists, findOne: Connection.findOne, create: Connection.create, notify: Notification.create };
  let stored = null;
  let notificationCount = 0;
  let initialLookups = 0;
  let releaseLookups;
  const lookupGate = new Promise((resolve) => { releaseLookups = resolve; });
  try {
    User.exists = async () => true;
    Connection.findOne = async () => {
      initialLookups += 1;
      if (initialLookups <= 2) {
        if (initialLookups === 2) releaseLookups();
        await lookupGate;
        return null;
      }
      return stored;
    };
    Connection.create = async (value) => {
      if (stored) {
        assert.equal(String(value._id), String(stored._id), 'opposite directions must use the same deterministic ID');
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      }
      stored = { ...value, status: 'pending' };
      return stored;
    };
    Notification.create = async () => { notificationCount += 1; };
    const results = await Promise.all([
      invoke(sendConnectionRequest, { body: { recipientId }, user: { userId: requesterId } }),
      invoke(sendConnectionRequest, { body: { recipientId: requesterId }, user: { userId: recipientId } })
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 201]);
    assert.equal(notificationCount, 1);
  } finally { User.exists = originals.exists; Connection.findOne = originals.findOne; Connection.create = originals.create; Notification.create = originals.notify; }
});

test('only the pending recipient can accept or decline a request', async () => {
  const originalUpdate = Connection.findOneAndUpdate;
  const originalNotify = Notification.create;
  try {
    Connection.findOneAndUpdate = async (query) => {
      assert.equal(query.recipient, recipientId);
      return null;
    };
    Notification.create = async () => { throw new Error('notification should not run'); };
    await assert.rejects(invoke(respondToConnectionRequest, { params: { id: '507f1f77bcf86cd799439013' }, body: { status: 'accepted' }, user: { userId: recipientId } }), /not found or already handled/i);
    await assert.rejects(invoke(respondToConnectionRequest, { params: { id: '507f1f77bcf86cd799439013' }, body: { status: 'rejected' }, user: { userId: recipientId } }), /not found or already handled/i);
  } finally { Connection.findOneAndUpdate = originalUpdate; Notification.create = originalNotify; }
});

test('valid acceptance updates trust and notifies the requester', async () => {
  const originals = { update: Connection.findOneAndUpdate, users: User.updateMany, notify: Notification.create };
  let notified;
  try {
    Connection.findOneAndUpdate = async () => ({ _id: 'connection', requester: requesterId, recipient: recipientId, status: 'accepted' });
    User.updateMany = async () => ({ modifiedCount: 2 });
    Notification.create = async (value) => { notified = value; };
    const result = await invoke(respondToConnectionRequest, { params: { id: '507f1f77bcf86cd799439013' }, body: { status: 'accepted' }, user: { userId: recipientId } });
    assert.equal(result.payload.data.status, 'accepted');
    assert.equal(notified.user, requesterId);
  } finally { Connection.findOneAndUpdate = originals.update; User.updateMany = originals.users; Notification.create = originals.notify; }
});

test('connection routes remain protected from unauthenticated requests', async () => {
  await new Promise((resolve) => authMiddleware({ headers: {} }, {}, (error) => {
    assert.equal(error.status, 401);
    resolve();
  }));
});

test('targeted student relationship omits private fields for an unconnected viewer', async () => {
  const originalFindOneUser = User.findOne;
  const originalFindOneConnection = Connection.findOne;
  try {
    User.findOne = () => ({
      select: async () => ({
        _id: recipientId,
        name: 'Student',
        email: 'private@example.edu',
        phoneNumber: '12345',
        whatsappNumber: '67890',
        contactVisibility: 'connections',
        toObject() { return { ...this, toObject: undefined }; }
      })
    });
    Connection.findOne = async () => null;
    const result = await invoke(getStudentRelationship, { params: { userId: recipientId }, user: { userId: requesterId } });
    assert.equal(result.payload.data.connection, null);
    assert.equal(result.payload.data.student.email, undefined);
    assert.equal(result.payload.data.student.phoneNumber, undefined);
    assert.equal(result.payload.data.student.whatsappNumber, undefined);
  } finally { User.findOne = originalFindOneUser; Connection.findOne = originalFindOneConnection; }
});
