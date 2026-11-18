import test from 'node:test';
import assert from 'node:assert/strict';
import { getConnectionActionState, updateStudentRelationship } from '../src/utils/connectionView.js';

test('relationship actions represent connect, outgoing, incoming, connected, restricted and self states', () => {
  assert.equal(getConnectionActionState(), 'connect');
  assert.equal(getConnectionActionState({ connection: { status: 'pending', direction: 'outgoing' } }), 'outgoing');
  assert.equal(getConnectionActionState({ connection: { status: 'pending', direction: 'incoming' } }), 'incoming');
  assert.equal(getConnectionActionState({ connection: { status: 'accepted' } }), 'connected');
  assert.equal(getConnectionActionState({ restricted: true }), 'restricted');
  assert.equal(getConnectionActionState({ isSelf: true }), 'self');
});

test('relationship updates remain localized to the selected student', () => {
  const students = [{ _id: 'a', connection: null }, { _id: 'b', connection: null }];
  const updated = updateStudentRelationship(students, 'b', { status: 'pending', direction: 'outgoing' });
  assert.equal(updated[0], students[0]);
  assert.equal(updated[1].connection.status, 'pending');
});
