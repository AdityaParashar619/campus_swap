import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'institutional-validation-test-secret';
process.env.NODE_ENV = 'test';
process.env.ALLOWED_COLLEGE_DOMAINS = 'satiengg.in';
process.env.INSTITUTION_EMAIL_PATTERN = '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$';
process.env.ENROLLMENT_PATTERN = '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$';
process.env.INSTITUTION_BRANCHES = 'cs,bc,ai,ds,it,iot,ec,ce,me,ee';

const [{ validateInstitutionalEmail }, { validateStudentIdentity }, { isPasswordStrong, getPasswordPolicy }] = await Promise.all([
  import('../utils/institutionalIdentity.js'),
  import('../controllers/authController.js'),
  import('../utils/passwordPolicy.js')
]);

const branches = ['cs', 'bc', 'ai', 'ds', 'it', 'iot', 'ec', 'ce', 'me', 'ee'];

test('accepts each configured SATI branch and extracts institutional identity', () => {
  for (const branch of branches) {
    const identity = validateInstitutionalEmail(`student27${branch}011@satiengg.in`);
    assert.equal(identity.branchCode, branch);
    assert.equal(identity.graduationYearCode, '27');
    assert.equal(identity.emailRollNumber, '011');
  }
});

test('normalizes email before validating and returning identity', () => {
  const identity = validateInstitutionalEmail('  Student27CS011@SATIENGG.IN  ');
  assert.equal(identity.email, 'student27cs011@satiengg.in');
});

test('rejects personal domains, unsupported branches and malformed roll numbers', () => {
  for (const email of [
    'student27cs011@gmail.com',
    'student27cs011@yahoo.com',
    'student27xx011@satiengg.in',
    'student27cs01@satiengg.in',
    'student27cs0111@satiengg.in',
    'student27cs011@other.satiengg.in',
    'student27cs011@satiengg.in.evil.test'
  ]) assert.throws(() => validateInstitutionalEmail(email));
  assert.throws(() => validateInstitutionalEmail(''));
  assert.throws(() => validateInstitutionalEmail('not-an-email'));
  assert.equal(validateInstitutionalEmail('  STUDENT27CS011@SATIENGG.IN  ').email, 'student27cs011@satiengg.in');
});

test('enrollment requires exact length, allowed branch, valid section, and same branch as email', () => {
  for (const branch of branches) {
    for (const section of ['10', '11']) {
      const valid = validateStudentIdentity({
        email: `student27${branch}011@satiengg.in`, enrollmentNumber: `0108${branch}27${section}01`, branch
      });
      assert.equal(valid.enrollmentNumber, `0108${branch}27${section}01`);
    }
  }
  for (const enrollmentNumber of [
    '0108cs271201',
    '0108cs2710011',
    '0108xx271001',
    '0108cs27xx01',
    '0108cs2710a1',
    '0108cs2710'
  ]) assert.throws(() => validateStudentIdentity({ email: 'student27cs011@satiengg.in', enrollmentNumber, branch: 'cs' }));
  assert.throws(() => validateStudentIdentity({ email: 'student27cs011@satiengg.in', enrollmentNumber: '0108it271001', branch: 'cs' }));
  assert.throws(() => validateStudentIdentity({ email: 'student27cs011@satiengg.in', enrollmentNumber: '0108cs271001', branch: 'xx' }));
});

test('backend password rules match every published requirement', () => {
  assert.equal(isPasswordStrong('Campus@2027'), true);
  assert.equal(isPasswordStrong('short@A1'), true);
  assert.equal(isPasswordStrong('Short@1'), false);
  assert.equal(isPasswordStrong('lowercase@2027'), false);
  assert.equal(isPasswordStrong('UPPERCASE@2027'), false);
  assert.equal(isPasswordStrong('NoNumber@'), false);
  assert.equal(isPasswordStrong('NoSpecial2027'), false);
  assert.equal(isPasswordStrong(`A1@${'a'.repeat(126)}`), false);
  assert.deepEqual(getPasswordPolicy('Campus@2027'), {
    minLength: true, maxLength: true, uppercase: true, lowercase: true, number: true, special: true
  });
});

test('password reset payload uses the same backend password strength policy', async () => {
  const { validatePasswordResetPayload } = await import('../middleware/validateMiddleware.js');
  let weakError;
  validatePasswordResetPayload({ body: { token: 'reset-token', password: 'weakpass' } }, {}, (error) => { weakError = error; });
  assert.equal(weakError.status, 400);
  assert.match(weakError.details.password, /8–128 characters/);

  let strongError;
  let continued = false;
  validatePasswordResetPayload({ body: { token: 'reset-token', password: 'Campus@2027' } }, {}, (error) => { strongError = error; continued = !error; });
  assert.equal(strongError, undefined);
  assert.equal(continued, true);
});
