import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidInstitutionalEmail, normalizeInstitutionalEmail } from '../src/utils/institutionalEmail.js';
import { getPasswordPolicy, isPasswordStrong } from '../src/utils/passwordPolicy.js';

test('SATI student email validates structure and normalizes case and whitespace', () => {
  for (const branch of ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee']) {
    assert.equal(isValidInstitutionalEmail(`student27${branch}025@satiengg.in`), true);
  }
  assert.equal(normalizeInstitutionalEmail('  EXAMPLE27CS987@SATIENGG.IN  '), 'example27cs987@satiengg.in');
  for (const email of [
    'abc@gmail.com', 'student@gmail.com', 'aditya27cs011@gmail.com',
    'aditya27xx011@satiengg.in', 'aditya27cs1@satiengg.in',
    'aditya27cs0011@satiengg.in', 'aditya27cs01@satiengg.in', ''
  ]) assert.equal(isValidInstitutionalEmail(email), false, email);
});

test('password policy has the same live checks for valid and weak input', () => {
  assert.equal(isPasswordStrong('Campus@2027'), true);
  for (const password of ['sho1A!', 'campus@2027', 'CAMPUS@2027', 'Campus@@@@', 'Campus2027']) {
    assert.equal(isPasswordStrong(password), false, password);
  }
  assert.deepEqual(getPasswordPolicy('Campus@2027'), {
    minLength: true, maxLength: true, uppercase: true, lowercase: true, number: true, special: true
  });
});
