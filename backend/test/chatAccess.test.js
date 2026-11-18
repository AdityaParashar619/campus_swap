import test from 'node:test';
import assert from 'node:assert/strict';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import { getChatAccess } from '../utils/connections.js';

test('accepted connections retain unrestricted chat access', async () => {
  const originalFindOne = Connection.findOne;
  const originalExists = Message.exists;
  Connection.findOne = async () => ({ _id: 'connection' });
  Message.exists = async () => { throw new Error('starter lookup should not run for a connection'); };
  try {
    assert.deepEqual(await getChatAccess('sender', 'receiver'), { isConnected: true, starterUsed: false, canSend: true });
  } finally {
    Connection.findOne = originalFindOne;
    Message.exists = originalExists;
  }
});

test('unconnected users receive exactly one starter-message opportunity per recipient', async () => {
  const originalFindOne = Connection.findOne;
  const originalExists = Message.exists;
  Connection.findOne = async () => null;
  try {
    Message.exists = async (query) => {
      assert.deepEqual(query, { sender: 'sender', receiver: 'receiver' });
      return null;
    };
    assert.deepEqual(await getChatAccess('sender', 'receiver'), { isConnected: false, starterUsed: false, canSend: true });
    Message.exists = async () => ({ _id: 'message' });
    assert.deepEqual(await getChatAccess('sender', 'receiver'), { isConnected: false, starterUsed: true, canSend: false });
  } finally {
    Connection.findOne = originalFindOne;
    Message.exists = originalExists;
  }
});
