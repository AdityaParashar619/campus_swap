import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordResetOtpPayload } from '../src/utils/passwordResetOtp.js';

test('password-reset verification sends normalized email and preserves OTP as a six-character string', () => {
  const payload = createPasswordResetOtpPayload('  STUDENT27CS011@SATIENGG.IN ', '004219');
  assert.deepEqual(payload, { email: 'student27cs011@satiengg.in', otp: '004219' });
  assert.equal(typeof payload.otp, 'string');
});
