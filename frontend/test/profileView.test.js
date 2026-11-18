import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileForm, buildProfileUpdate, displayProfileValue, getProfileInitials, INSTITUTION_NAME } from '../src/utils/profileView.js';

test('registration-backed profile values prefill editable fields', () => {
  const form = buildProfileForm({ name: 'Student', bio: 'Stored bio', interests: ['React'], skills: ['Node'], phoneNumber: '123', contactVisibility: 'private' });
  assert.equal(form.name, 'Student'); assert.equal(form.bio, 'Stored bio'); assert.equal(form.interests, 'React'); assert.equal(form.contactVisibility, 'private');
});

test('profile updates contain only approved normalized fields', () => {
  const update = buildProfileUpdate({ name: ' Student ', bio: ' Bio ', interests: 'React, , UX', skills: 'Node', phoneNumber: ' 123 ', whatsappNumber: '', contactVisibility: 'connections' });
  assert.deepEqual(update, { name: 'Student', bio: 'Bio', phoneNumber: '123', whatsappNumber: '', contactVisibility: 'connections', interests: ['React', 'UX'], skills: ['Node'] });
  assert.equal('email' in update, false); assert.equal('enrollmentNumber' in update, false); assert.equal('collegeName' in update, false);
});

test('college, missing values, and avatar fallback are stable', () => {
  assert.equal(INSTITUTION_NAME, 'Samrat Ashok Technological Institute, Vidisha');
  assert.equal(displayProfileValue(null), 'Not available'); assert.equal(getProfileInitials('Ada Lovelace'), 'AL'); assert.equal(getProfileInitials(''), '?');
});
