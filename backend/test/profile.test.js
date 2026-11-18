import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../models/User.js';
import { updateProfile } from '../controllers/authController.js';
import { academicProfile, INSTITUTION_NAME } from '../utils/institution.js';
import { validateAvatar } from '../services/avatarService.js';

const userId = '507f1f77bcf86cd799439011';
const invoke = (handler, req) => new Promise((resolve, reject) => handler(req, { json: resolve }, reject));

test('registration academic fields map to the profile without duplicate storage', () => {
  const stored = { branch: 'cs', semester: '5', course: 'legacy course', yearSemester: 'legacy year' };
  assert.deepEqual(academicProfile(stored), { collegeName: INSTITUTION_NAME, course: 'cs', yearSemester: '5' });
  assert.deepEqual(academicProfile({ course: 'Legacy', yearSemester: '2' }), { collegeName: INSTITUTION_NAME, course: 'Legacy', yearSemester: '2' });
  assert.equal(INSTITUTION_NAME, 'Samrat Ashok Technological Institute, Vidisha');
});

test('editable profile fields normalize and update only the authenticated user', async () => {
  const original = User.findByIdAndUpdate; let query; let update;
  try {
    User.findByIdAndUpdate = async (id, value) => { query = id; update = value; return { _id: id, name: value.name, email: 'student@satiengg.in', branch: 'cs', semester: '5', role: 'student' }; };
    const response = await invoke(updateProfile, { user: { userId }, body: { name: '  Student Name  ', bio: '  Bio  ', interests: [' React ', ''], skills: [' Node '], contactVisibility: 'private' } });
    assert.equal(query, userId); assert.equal(update.name, 'Student Name'); assert.equal(update.bio, 'Bio');
    assert.deepEqual(update.interests, ['React']); assert.deepEqual(update.skills, ['Node']);
    assert.equal(response.data.collegeName, INSTITUTION_NAME);
  } finally { User.findByIdAndUpdate = original; }
});

test('college, enrollment, email, branch, avatar URL, and role cannot be profile-assigned', async () => {
  for (const field of ['collegeName', 'enrollmentNumber', 'email', 'branch', 'profilePicture', 'role']) {
    await assert.rejects(invoke(updateProfile, { user: { userId }, body: { [field]: 'attacker' } }), new RegExp(`${field} cannot be changed`, 'i'));
  }
});

test('invalid editable profile values are rejected before database writes', async () => {
  await assert.rejects(invoke(updateProfile, { user: { userId }, body: { name: 'x'.repeat(61) } }), /name must be/i);
  await assert.rejects(invoke(updateProfile, { user: { userId }, body: { contactVisibility: 'public' } }), /invalid contact visibility/i);
  await assert.rejects(invoke(updateProfile, { user: { userId }, body: { skills: ['x'.repeat(51)] } }), /at most 50/i);
});

test('avatar validation rejects empty, spoofed, and oversized files', async () => {
  await assert.rejects(validateAvatar(null), /select a profile image/i);
  await assert.rejects(validateAvatar({ buffer: Buffer.from('not-an-image'), size: 12, mimetype: 'image/jpeg' }), /malformed/i);
  await assert.rejects(validateAvatar({ buffer: Buffer.alloc(1), size: 3 * 1024 * 1024, mimetype: 'image/png' }), /up to 2 MB/i);
});
