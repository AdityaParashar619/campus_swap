import { env } from '../config/env.js';
import { BadRequest } from './AppError.js';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
let emailMatcher;
try {
  emailMatcher = new RegExp(env.institutionEmailPattern);
  if (emailMatcher.global || emailMatcher.sticky) throw new Error('stateful pattern');
} catch {
  throw new Error('INSTITUTION_EMAIL_PATTERN must be a valid non-stateful regular expression');
}

const institutionalStudentEmailPattern = (allowedBranches) => {
  const branchAlternation = [...allowedBranches]
    .sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return new RegExp(`^([a-z]+)([0-9]{2})(${branchAlternation})([0-9]{3})@satiengg\\.in$`);
};
const studentEmailMatcher = institutionalStudentEmailPattern(env.institutionBranches);

export const validateInstitutionalEmail = (rawEmail, { allowedDomains = env.allowedCollegeDomains, emailPattern = env.institutionEmailPattern, allowedBranches = env.institutionBranches } = {}) => {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new BadRequest('Email is required.');
  if (!/^[^@]+@[^@]+$/.test(email)) throw new BadRequest('Enter a valid email address.');
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (domain !== 'satiengg.in' || !allowedDomains.includes(domain)) {
    throw new BadRequest('Use your SATI institutional email address ending in @satiengg.in.');
  }
  let matcher;
  try {
    matcher = emailPattern === env.institutionEmailPattern ? emailMatcher : new RegExp(emailPattern);
    if (matcher.global || matcher.sticky) throw new Error('stateful pattern');
  } catch {
    throw new Error('INSTITUTION_EMAIL_PATTERN must be a valid non-stateful regular expression');
  }
  if (!matcher.test(email)) {
    throw new BadRequest('Email must match the SATI student format: name, two-digit year, supported branch, and three-digit roll number.');
  }

  const match = email.match(institutionalStudentEmailPattern(allowedBranches));
  if (!match || !allowedBranches.includes(match[3])) {
    throw new BadRequest('Email contains an unsupported branch code or malformed roll number.');
  }
  return {
    email,
    namePrefix: match[1],
    graduationYearCode: match[2],
    branchCode: match[3],
    emailRollNumber: match[4]
  };
};

export const isInstitutionalStudentEmail = (email) =>
  studentEmailMatcher.test(email) && emailMatcher.test(email);

export const facultyUnexpectedIdentityFilter = () => ({
  $nor: [
    { email: env.adminEmail, role: 'admin', accountType: 'staff' },
    { email: 'reviewer@demo.invalid', role: 'student', accountType: 'student' },
    {
      role: 'student',
      accountType: 'student',
      $and: [
        { email: { $ne: env.adminEmail, $regex: studentEmailMatcher } },
        { email: { $regex: emailMatcher } }
      ]
    }
  ]
});

export const assertInstitutionalEmailConfiguration = () => {
  if (!env.allowedCollegeDomains.includes('satiengg.in')) throw new Error('ALLOWED_COLLEGE_DOMAINS must include satiengg.in');
  const sample = `student27${env.institutionBranches[0]}011@satiengg.in`;
  if (!emailMatcher.test(sample)) {
    if (env.nodeEnv === 'production') throw new Error('INSTITUTION_EMAIL_PATTERN must accept the configured SATI institutional format');
    throw new Error('INSTITUTION_EMAIL_PATTERN must accept the configured SATI institutional format');
  }
};

assertInstitutionalEmailConfiguration();
