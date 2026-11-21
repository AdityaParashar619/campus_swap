import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isSafeNoteFileUrl, normalizeNoteInput } from '../utils/noteValidation.js';

test('Notes accepts bounded HTTPS resources while preserving string semesters', () => {
  const note = normalizeNoteInput({ title: '  Algorithms  ', fileUrl: 'https://cdn.example.edu/notes.pdf', branch: 'CSE', semester: '7', subject: 'DSA' });
  assert.equal(note.title, 'Algorithms');
  assert.equal(note.semester, '7');
  assert.equal(note.fileType, 'other');
  assert.equal(isSafeNoteFileUrl(note.fileUrl), true);
});

test('Notes rejects dangerous URL protocols and invalid semesters', () => {
  for (const fileUrl of ['javascript:alert(1)', 'data:text/html,test', 'file:///secret', 'http://example.edu/note.pdf']) {
    assert.throws(() => normalizeNoteInput({ title: 'Unsafe', fileUrl, branch: 'CSE', semester: '7', subject: 'DSA' }), /HTTPS URL/);
  }
  assert.throws(() => normalizeNoteInput({ title: 'Bad semester', fileUrl: 'https://example.edu/note.pdf', branch: 'CSE', semester: '9', subject: 'DSA' }), /between 1 and 8/);
});

test('Notes read, create, and bookmark routes all require authentication', () => {
  const routes = fs.readFileSync(new URL('../routes/noteRoutes.js', import.meta.url), 'utf8');
  assert.match(routes, /router\.get\('\/', authMiddleware, getNotes\)/);
  assert.match(routes, /router\.post\('\/', authMiddleware, createNote\)/);
  assert.match(routes, /router\.post\('\/:id\/bookmark', authMiddleware, toggleBookmarkNote\)/);
});
