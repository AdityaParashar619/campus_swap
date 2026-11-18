import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { normalizeMessageInput } from '../controllers/messageController.js';

test('chat input rejects malformed recipients, non-string text, and oversized payloads', () => {
  const receiverId = new mongoose.Types.ObjectId().toString();
  assert.throws(() => normalizeMessageInput({ receiverId: 'not-an-id', text: 'hello' }), /valid receiver/i);
  assert.throws(() => normalizeMessageInput({ receiverId, text: { nested: true } }), /text is required/i);
  assert.throws(() => normalizeMessageInput({ receiverId, text: 'x'.repeat(2001) }), /2000 characters/i);
});

test('chat input trims bounded text and preserves the validated recipient', () => {
  const receiverId = new mongoose.Types.ObjectId().toString();
  assert.deepEqual(normalizeMessageInput({ receiverId, text: '  hello  ' }), { receiverId, text: 'hello' });
});
