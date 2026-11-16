import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversationClasses, getMessageBubbleClasses } from '../src/utils/chatPresentation.js';

test('light chat bubbles use a brand surface for outgoing and a light neutral incoming surface', () => {
  assert.match(getMessageBubbleClasses(true), /bg-blue-600/);
  assert.doesNotMatch(getMessageBubbleClasses(true), /bg-slate-950/);
  assert.match(getMessageBubbleClasses(false), /bg-white/);
  assert.match(getMessageBubbleClasses(false), /dark:bg-slate-800/);
});

test('conversation selection is theme aware without a hardcoded black light surface', () => {
  assert.match(getConversationClasses(true), /bg-blue-50/);
  assert.match(getConversationClasses(true), /dark:bg-blue-950/);
  assert.match(getConversationClasses(false), /bg-white/);
});
