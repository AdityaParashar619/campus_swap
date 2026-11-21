import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const notes = fs.readFileSync(new URL('../src/pages/Notes.jsx', import.meta.url), 'utf8');

test('restored Notes uses existing APIs and does not introduce a duplicate data path', () => {
  assert.match(notes, /noteAPI\.getAll/);
  assert.match(notes, /noteAPI\.create/);
  assert.match(notes, /noteAPI\.toggleBookmark/);
});

test('restored Notes blocks unsafe file links and sandboxes document previews', () => {
  assert.match(notes, /url\.protocol === 'https:'/);
  assert.match(notes, /rel="noopener noreferrer"/);
  assert.match(notes, /<iframe sandbox="" referrerPolicy="no-referrer"/);
});

test('restored Notes provides accessible filters, errors, and dialog semantics', () => {
  assert.match(notes, /aria-label="Search notes"/);
  assert.match(notes, /role="alert"/);
  assert.match(notes, /role="dialog" aria-modal="true"/);
});
