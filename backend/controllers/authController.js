import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { env } from '../config/env.js';
import { BadRequest, Conflict, Forbidden, InternalError, NotFound, ServiceUnavailable, Unauthorized } from '../utils/AppError.js';
import { createOpaqueToken, createOtp, hashOtp, hashToken, signAuthToken, secureHashEquals } from '../utils/auth.js';
import { getPermissions } from '../utils/permissions.js';
import EmailVerification from '../models/EmailVerification.js';
import EnrollmentReservation from '../models/EnrollmentReservation.js';
import RefreshSession from '../models/RefreshSession.js';
import AlumniVerification from '../models/AlumniVerification.js';
import AuditLog from '../models/AuditLog.js';
import { sendPasswordChangedConfirmation, sendPasswordReset, sendPasswordResetCode, sendVerificationCode } from '../utils/emailProvider.js';
import Connection from '../models/Connection.js';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import Note from '../models/Note.js';
import RequestPost from '../models/RequestPost.js';
import User from '../models/User.js';
import { exposeContactForConnection } from '../utils/connections.js';
import { consumeDevelopmentMail } from '../utils/devMailCapture.js';
import { isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy.js';
import { validateInstitutionalEmail } from '../utils/institutionalIdentity.js';
import { academicProfile } from '../utils/institution.js';
import { uploadAvatar } from '../services/avatarService.js';

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  enrollmentNumber: user.enrollmentNumber,
  role: user.role,
  accountType: user.accountType || 'student',
  department: user.department || '',
  branch: user.branch || '',
  semester: user.semester || user.yearSemester || '',
  graduationYear: user.graduationYear,
  company: user.company || '',
  jobTitle: user.jobTitle || '',
  emailVerified: user.emailVerified ?? true,
  verificationStatus: user.verificationStatus || (user.isVerifiedStudent ? 'verified' : 'pending'),
  verificationMethod: user.verificationMethod || 'legacy',
  accountStatus: user.accountStatus || (user.isBlocked ? 'blocked' : 'active'),
  permissions: getPermissions(user),
  profilePicture: user.profilePicture,
  phoneNumber: user.phoneNumber,
  whatsappNumber: user.whatsappNumber,
  contactVisibility: user.contactVisibility,
  ...academicProfile(user),
  bio: user.bio,
  interests: user.interests,
  skills: user.skills,
  trustScore: user.trustScore,
  isVerifiedStudent: user.isVerifiedStudent,
  createdAt: user.createdAt
});

const passwordIsValid = isPasswordStrong;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const validateCollegeEmail = (rawEmail, { allowedDomains = env.allowedCollegeDomains, emailPattern = env.institutionEmailPattern, production = env.nodeEnv === 'production' } = {}) => {
  return validateInstitutionalEmail(rawEmail, { allowedDomains, emailPattern });
};

export const validateStudentIdentity = ({ email: rawEmail, enrollmentNumber: rawEnrollment, branch: rawBranch }, {
  allowedDomains = env.allowedCollegeDomains,
  emailPattern = env.institutionEmailPattern,
  enrollmentPattern = env.enrollmentPattern,
  allowedBranches = env.institutionBranches,
  production = env.nodeEnv === 'production'
} = {}) => {
  const email = normalizeEmail(rawEmail);
  const enrollmentNumber = String(rawEnrollment || '').trim().toLowerCase();
  const branch = String(rawBranch || '').trim().toLowerCase();
  const parsedEmail = validateInstitutionalEmail(email, { allowedDomains, emailPattern, allowedBranches });
  if (!allowedBranches.includes(branch)) throw new BadRequest('Branch code is not allowed.');
  if (parsedEmail.branchCode !== branch) throw new BadRequest('Branch code must match the institutional email address.');

  const branchAlternation = [...allowedBranches]
    .sort((left, right) => right.length - left.length)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const strictEnrollmentMatcher = new RegExp(`^0108(${branchAlternation})[0-9]{2}(10|11)[0-9]{2}$`);
  const strictEnrollmentMatch = enrollmentNumber.match(strictEnrollmentMatcher);
  if (!strictEnrollmentMatch) throw new BadRequest('Enrollment number does not match the required SATI format.');

  let enrollmentMatcher;
  try {
    enrollmentMatcher = enrollmentPattern ? new RegExp(enrollmentPattern) : null;
    if (enrollmentMatcher?.global || enrollmentMatcher?.sticky) throw new Error('stateful regex flags not permitted');
  } catch {
    throw new Error('ENROLLMENT_PATTERN must be a valid non-stateful regular expression');
  }
  if (enrollmentMatcher && !enrollmentMatcher.test(enrollmentNumber)) {
    throw new BadRequest('Enrollment number does not match the required format.');
  }
  if (enrollmentMatcher) {
    const enrollmentBranch = strictEnrollmentMatch[1];
    if (enrollmentBranch && enrollmentBranch !== branch) throw new BadRequest('Enrollment branch code must match the registration branch.');
  }
  return { email, enrollmentNumber, branch, ...parsedEmail };
};
const validateInstitutionField = (value, allowed, field) => {
  if (allowed.length && !allowed.includes(value)) throw new BadRequest(`Invalid ${field}.`);
};
const registrationAcceptedMessage = () => env.emailProvider !== 'gmail' && env.nodeEnv === 'development' && env.otpMockEnabled
  ? 'If registration details are eligible, a code is available in local mail capture.'
  : env.emailProvider === 'resend' && env.resendTestMode
    ? 'If registration details are eligible, a code was sent to the configured Resend test recipient.'
    : 'If registration details are eligible, a verification code has been sent.';
const setRefreshCookie = (res, token) => res.cookie('refreshToken', token, {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000
});

const issueSession = async (user, req, res, familyId = crypto.randomUUID(), persistSession = (data) => RefreshSession.create(data)) => {
  const refreshToken = createOpaqueToken();
  const accessToken = signAuthToken({ userId: user._id.toString(), tokenVersion: user.tokenVersion || 0 });
  await persistSession({
  user: user._id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ipAddress: req.ip
  });
  req.issuedRefreshTokenHash = hashToken(refreshToken);
  setRefreshCookie(res, refreshToken);
  return { token: accessToken, user: sanitizeUser(user) };
};

const reserveEnrollment = async (email, enrollmentNumber, expiresAt) => {
  const now = new Date();
  const currentEmailReservation = await EnrollmentReservation.findOne({ email, expiresAt: { $gt: now } });
  if (currentEmailReservation) return currentEmailReservation.enrollmentNumber === enrollmentNumber ? currentEmailReservation : null;

  try {
    const reclaimed = await EnrollmentReservation.findOneAndUpdate(
      { enrollmentNumber, expiresAt: { $lte: now } },
      { $set: { email, expiresAt } },
      { new: true }
    );
    if (reclaimed) return reclaimed;
    return await EnrollmentReservation.findOneAndUpdate(
      { email, $or: [{ expiresAt: { $lte: now } }, { expiresAt: null }] },
      { $set: { enrollmentNumber, expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    const racedReservation = await EnrollmentReservation.findOne({ email, expiresAt: { $gt: new Date() } });
    return racedReservation?.enrollmentNumber === enrollmentNumber ? racedReservation : null;
  }
};
const releaseEnrollment = (email, enrollmentNumber) => EnrollmentReservation.deleteOne({ email, enrollmentNumber });
const claimableStudentOtpFilter = (email) => ({
  email,
  kind: 'student',
  $or: [
    { lastSentAt: { $lte: new Date(Date.now() - env.otpResendCooldownSeconds * 1000) } },
    { lastSentAt: null }
  ]
});

const registerStudentLogic = async (req, res, deliverCode, isDuplicate = (query, collection) => collection === 'accountByEmail' ? User.findOne(query) : collection === 'accountByEnrollment' ? User.exists(query) : collection === 'pending' ? EmailVerification.exists(query) : collection === 'pendingEntry' ? EmailVerification.findOne(query) : User.exists(query), savePending = (filter, update, options) => EmailVerification.findOneAndUpdate(filter, update, options), removePending = (id) => EmailVerification.deleteOne({ _id: id }), reserve = reserveEnrollment, release = releaseEnrollment, generateCode = createOtp) => {
  const { name, email: rawEmail, enrollmentNumber, department, branch, semester, phoneNumber, password, confirmPassword } = req.body;
  const email = normalizeEmail(rawEmail);
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new BadRequest('Enter a valid institutional email address.');
  }
  validateCollegeEmail(email);

  const existingAccount = await isDuplicate({ email }, 'accountByEmail');
  if (existingAccount) {
    if (existingAccount.emailVerified === true) {
      throw new Conflict('This email is already registered. Please log in.');
    }

    const resumableAccount = ['student', null, undefined].includes(existingAccount.accountType)
      && ['active', 'pending', null, undefined].includes(existingAccount.accountStatus)
      && existingAccount.verificationStatus !== 'rejected'
      && existingAccount.isBlocked !== true;
    if (!resumableAccount) {
      throw new Conflict('This email is already associated with an account. Please log in or contact support.');
    }

    const pendingEntry = await isDuplicate({ email, kind: 'student' }, 'pendingEntry');
    if (pendingEntry?.lastSentAt && Date.now() - pendingEntry.lastSentAt.getTime() < env.otpResendCooldownSeconds * 1000) {
      return res.status(202).json({ success: true, message: 'Your account is awaiting email verification. Check your inbox for the current code.' });
    }

    const otp = generateCode();
    const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);
    let entry;
    try {
      entry = await savePending(
        claimableStudentOtpFilter(email),
        { $set: { payload: { resumeUserId: existingAccount._id.toString() }, otpHash: hashOtp(email, otp, 'student-verification'), authorizationHash: null, expiresAt, attempts: 0, lastSentAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code === 11000) {
        const racedAccount = await isDuplicate({ email }, 'accountByEmail');
        if (racedAccount?.emailVerified === true) throw new Conflict('This email is already registered. Please log in.');
        const racedEntry = await isDuplicate({ email, kind: 'student' }, 'pendingEntry');
        if (racedEntry) return res.status(202).json({ success: true, message: 'Your account is awaiting email verification. Check your inbox for the current code.' });
      }
      throw error;
    }
    try {
      const delivery = await deliverCode({ to: email, code: otp, requestId: req.requestId });
      return res.status(202).json({ success: true, message: 'Your account is awaiting email verification. A code has been sent.', ...(delivery.previewToken ? { devMailPreviewToken: delivery.previewToken } : {}), expiresAt: entry.expiresAt });
    } catch {
      await removePending(entry._id);
      throw new ServiceUnavailable('Email delivery is temporarily unavailable. Please retry later.');
    }
  }

  if (!name?.trim() || !enrollmentNumber?.trim() || !department?.trim() || !branch?.trim() || !semester || !phoneNumber?.trim()) {
    throw new BadRequest('Complete all required student fields.');
  }
  if (!passwordIsValid(password)) throw new BadRequest(PASSWORD_POLICY_MESSAGE);
  if (password !== confirmPassword) throw new BadRequest('Passwords do not match.');
  const identity = validateStudentIdentity({ email, enrollmentNumber, branch });
  const emailBranch = identity.branchCode;
  if (emailBranch && emailBranch !== identity.branch) throw new BadRequest('Branch code must match the institutional email address.');
  validateInstitutionField(department, env.institutionDepartments, 'department');
  validateInstitutionField(identity.branch, env.institutionBranches, 'branch');
  validateInstitutionField(String(semester), env.institutionSemesters, 'semester/year');
  if (await isDuplicate({ enrollmentNumber: identity.enrollmentNumber }, 'accountByEnrollment')) throw new Conflict('This enrollment number is already registered. Please log in.');
  const pendingEntry = await isDuplicate({ email, kind: 'student' }, 'pendingEntry');
  if (pendingEntry?.lastSentAt && Date.now() - pendingEntry.lastSentAt.getTime() < env.otpResendCooldownSeconds * 1000) return res.status(202).json({ success: true, message: registrationAcceptedMessage() });
  const pendingEnrollment = await isDuplicate({ kind: 'student', 'payload.enrollmentNumber': identity.enrollmentNumber, email: { $ne: email }, expiresAt: { $gt: new Date() } }, 'pending');
  if (pendingEnrollment) return res.status(202).json({ success: true, message: registrationAcceptedMessage() });

  const otp = generateCode();
  const payload = {
    name: name.trim(), email: identity.email, enrollmentNumber: identity.enrollmentNumber, department: department.trim(), branch: identity.branch,
    semester: String(semester), yearSemester: String(semester), phoneNumber: phoneNumber.trim(),
    institutionalYearCode: identity.graduationYearCode, institutionalRollNumber: identity.emailRollNumber,
    password: await bcrypt.hash(password, 12)
  };
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);
  let reservation;
  try {
    reservation = await reserve(email, identity.enrollmentNumber, expiresAt);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  if (!reservation) return res.status(202).json({ success: true, message: registrationAcceptedMessage() });

  let entry;
  try {
    entry = await savePending(
      claimableStudentOtpFilter(email),
      { $set: { payload, otpHash: hashOtp(email, otp, 'student-verification'), authorizationHash: null, expiresAt, attempts: 0, lastSentAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code === 11000) {
      const racedAccount = await isDuplicate({ email }, 'accountByEmail');
      if (racedAccount?.emailVerified === true) throw new Conflict('This email is already registered. Please log in.');
      const racedEntry = await isDuplicate({ email, kind: 'student' }, 'pendingEntry');
      if (racedEntry) return res.status(202).json({ success: true, message: registrationAcceptedMessage(), expiresAt: racedEntry.expiresAt });
    }
    await release(email, identity.enrollmentNumber);
    throw error;
  }
  let delivery;
  try {
    delivery = await deliverCode({ to: email, code: otp, requestId: req.requestId });
  } catch (error) {
    await Promise.all([removePending(entry._id), release(email, identity.enrollmentNumber)]);
    throw new ServiceUnavailable('Email delivery is temporarily unavailable. Please retry later.');
  }
  res.status(202).json({ success: true, message: registrationAcceptedMessage(), ...(delivery.previewToken ? { devMailPreviewToken: delivery.previewToken } : {}), expiresAt: entry.expiresAt });
};

export const registerStudent = asyncHandler((req, res) => registerStudentLogic(req, res, sendVerificationCode));
export const createRegisterStudentHandler = ({ deliverCode = sendVerificationCode, generateCode = createOtp, isDuplicate = (query, collection) => collection === 'accountByEmail' ? User.findOne(query) : collection === 'accountByEnrollment' ? User.exists(query) : collection === 'pending' ? EmailVerification.exists(query) : collection === 'pendingEntry' ? EmailVerification.findOne(query) : User.exists(query), savePending = (filter, update, options) => EmailVerification.findOneAndUpdate(filter, update, options), removePending = (id) => EmailVerification.deleteOne({ _id: id }), reserveEnrollment: reserve = reserveEnrollment, releaseEnrollment: release = releaseEnrollment } = {}) => (req, res) => registerStudentLogic(req, res, deliverCode, isDuplicate, savePending, removePending, reserve, release, generateCode);

export const verifyStudentEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const otpHash = hashOtp(email, otp, 'student-verification');
  const entry = await EmailVerification.findOne({ email, kind: 'student', expiresAt: { $gt: new Date() }, attempts: { $lt: env.otpMaxAttempts } });
  const resumingExistingAccount = Boolean(entry?.payload?.resumeUserId);
  const reservation = entry && !resumingExistingAccount && await EnrollmentReservation.findOne({ email, enrollmentNumber: entry.payload.enrollmentNumber, expiresAt: { $gt: new Date() } });
  if (entry && !resumingExistingAccount && !reservation) {
    let claimedReservation;
    try {
      claimedReservation = await reserveEnrollment(email, entry.payload.enrollmentNumber, entry.expiresAt);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    if (!claimedReservation) throw new BadRequest('Invalid or expired verification code.');
  }
  const valid = entry && secureHashEquals(entry.otpHash, otpHash);
  const claimed = valid ? await EmailVerification.findOneAndUpdate(
    { _id: entry._id, otpHash, expiresAt: { $gt: new Date() }, attempts: { $lt: env.otpMaxAttempts } },
    { $set: { attempts: env.otpMaxAttempts } },
    { new: false }
  ) : null;
  if (!claimed) {
    await EmailVerification.updateOne({ email, kind: 'student', attempts: { $lt: env.otpMaxAttempts }, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } });
    throw new BadRequest('Invalid or expired verification code.');
  }
  let user;
  if (resumingExistingAccount) {
    user = await User.findOneAndUpdate(
      { _id: claimed.payload.resumeUserId, email, accountType: { $in: ['student', null] }, emailVerified: { $ne: true }, accountStatus: { $in: ['active', 'pending', null] }, isBlocked: { $ne: true } },
      { $set: { emailVerified: true, verificationStatus: 'verified', verificationMethod: 'college_email_otp', accountStatus: 'active', isVerifiedStudent: true } },
      { new: true }
    );
    if (!user) {
      await EmailVerification.deleteOne({ _id: claimed._id });
      throw new BadRequest('Invalid or expired verification code.');
    }
  } else {
    try {
      user = await User.create({ ...claimed.payload, accountType: 'student', role: 'student', emailVerified: true, verificationStatus: 'verified', verificationMethod: 'college_email_otp', accountStatus: 'active', isVerifiedStudent: true });
    } catch (error) {
      if (error.code === 11000) {
        await Promise.all([EmailVerification.deleteOne({ _id: claimed._id }), releaseEnrollment(email, claimed.payload.enrollmentNumber)]);
        throw new Conflict('Email or enrollment number already exists.');
      }
      throw error;
    }
  }
  await Promise.all([
    EmailVerification.deleteOne({ _id: claimed._id, attempts: env.otpMaxAttempts }),
    ...(resumingExistingAccount ? [] : [releaseEnrollment(email, claimed.payload.enrollmentNumber)])
  ]);
  const session = await issueSession(user, req, res);
  res.status(201).json({ success: true, message: 'Email verified.', ...session });
});

export const resendStudentOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const entry = await EmailVerification.findOne({ email, kind: 'student' });
  if (!entry) return res.json({ success: true, message: env.emailProvider === 'resend' && env.resendTestMode ? 'If a pending registration exists, a code was sent to the configured Resend test recipient.' : 'If a pending registration exists, a new code has been sent.' });
  if (entry.lastSentAt && Date.now() - entry.lastSentAt.getTime() < env.otpResendCooldownSeconds * 1000) throw new BadRequest('Please wait before requesting another code.');
  const otp = createOtp();
  const oldState = { otpHash: entry.otpHash, expiresAt: entry.expiresAt, attempts: entry.attempts, lastSentAt: entry.lastSentAt };
  entry.otpHash = hashOtp(email, otp, 'student-verification');
  entry.expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);
  entry.attempts = 0;
  await entry.save();
  let delivery;
  try {
    delivery = await sendVerificationCode({ to: email, code: otp, requestId: req.requestId });
  } catch (error) {
    Object.assign(entry, oldState);
    await entry.save();
    throw new ServiceUnavailable('Email delivery is temporarily unavailable. Please retry later.');
  }
  entry.lastSentAt = new Date();
  await entry.save();
  const message = env.emailProvider === 'resend' && env.resendTestMode ? 'If a pending registration exists, a code was sent to the configured Resend test recipient.' : 'If a pending registration exists, a new code has been sent.';
  res.json({ success: true, message, ...(delivery.previewToken ? { devMailPreviewToken: delivery.previewToken } : {}) });
});

export const registerAlumni = asyncHandler(async (req, res) => {
  const { name, email: rawEmail, graduationYear, department, branch, previousEnrollmentNumber = '', company = '', jobTitle = '', password, confirmPassword } = req.body;
  const email = normalizeEmail(rawEmail);
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !Number.isInteger(Number(graduationYear)) || !department?.trim() || !branch?.trim()) throw new BadRequest('Complete all required alumni fields.');
  if (!passwordIsValid(password) || password !== confirmPassword) throw new BadRequest(`${PASSWORD_POLICY_MESSAGE} Passwords must match.`);
  if (await User.exists({ email })) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  const existingApplication = await AlumniVerification.findOne({ email });
  if (existingApplication) {
    if (existingApplication.status !== 'email_pending') return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
    if (existingApplication.emailLastSentAt && Date.now() - existingApplication.emailLastSentAt.getTime() < env.otpResendCooldownSeconds * 1000) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  }
  const rawVerificationToken = createOpaqueToken();
  const payload = { name: name.trim(), email, password: await bcrypt.hash(password, 12), graduationYear: Number(graduationYear), department, branch, previousEnrollmentNumber, company, jobTitle };
  let verification;
  try {
    verification = await AlumniVerification.findOneAndUpdate(
      existingApplication
        ? { email, status: 'email_pending', emailLastSentAt: { $lte: new Date(Date.now() - env.otpResendCooldownSeconds * 1000) } }
        : { email },
      { $set: { email, payload, emailTokenHash: hashToken(rawVerificationToken), emailTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000), emailLastSentAt: new Date(), status: 'email_pending', graduationYear: Number(graduationYear), department, branch, previousEnrollmentNumber, company, jobTitle } },
      { upsert: !existingApplication, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code === 11000) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
    throw error;
  }
  if (!verification) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  let delivery;
  try {
    const frontendOrigin = env.frontendUrl.split(',')[0].replace(/\/$/, '');
    const verificationUrl = `${frontendOrigin}/verify-alumni?email=${encodeURIComponent(email)}#token=${encodeURIComponent(rawVerificationToken)}`;
    delivery = await sendPasswordReset({ to: email, resetUrl: verificationUrl, template: 'campusswap-alumni-email-verification', requestId: req.requestId });
  } catch (error) {
    if (existingApplication) {
      await AlumniVerification.updateOne({ _id: verification._id, emailTokenHash: hashToken(rawVerificationToken) }, { $set: { emailTokenHash: null, emailTokenExpiresAt: null, emailLastSentAt: existingApplication.emailLastSentAt || null, payload: existingApplication.payload || null } });
    } else {
      await AlumniVerification.deleteOne({ _id: verification._id, emailTokenHash: hashToken(rawVerificationToken) });
    }
    throw new BadRequest('Email delivery is temporarily unavailable. Please retry later.');
  }
  res.status(202).json({ success: true, message: 'Alumni verification request submitted for institutional review.', verificationStatus: 'pending', ...(delivery.previewToken ? { devMailPreviewToken: delivery.previewToken } : {}) });
});

export const verifyAlumniEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.token || '').trim();
  if (!token) throw new BadRequest('Invalid or expired verification link.');
  const tokenHash = hashToken(token);
  const verification = await AlumniVerification.findOneAndUpdate({ email, status: 'email_pending', emailTokenHash: tokenHash, emailTokenExpiresAt: { $gt: new Date() }, emailVerificationClaimedAt: null }, { $set: { emailVerificationClaimedAt: new Date() } }, { new: true });
  if (!verification) throw new BadRequest('Invalid or expired verification link.');
  const data = verification.payload;
  let user;
  try {
    user = await User.create({ name: data.name, email: data.email, enrollmentNumber: null, password: data.password, role: 'alumni', accountType: 'alumni', accountStatus: 'pending', emailVerified: true, verificationStatus: 'pending', verificationMethod: 'alumni_review', graduationYear: data.graduationYear, department: data.department, branch: data.branch, company: data.company, jobTitle: data.jobTitle });
  } catch (error) {
    await AlumniVerification.updateOne({ _id: verification._id, emailTokenHash: tokenHash }, { $set: { emailVerificationClaimedAt: null } });
    if (error.code === 11000) throw new Conflict('This email is already registered.');
    throw error;
  }
  verification.user = user._id;
  verification.payload = null;
  verification.status = 'pending';
  verification.emailTokenHash = null;
  verification.emailTokenExpiresAt = null;
  verification.emailVerificationClaimedAt = null;
  await verification.save();
  res.json({ success: true, message: 'Email verified. Alumni approval is still pending.' });
});

export const refreshSession = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) throw new Unauthorized('Session unavailable. Please sign in again.');
  const tokenHash = hashToken(rawToken);
  const session = await RefreshSession.findOneAndUpdate({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } }, { $set: { revokedAt: new Date() } }, { new: false });
  if (!session) {
    const reused = await RefreshSession.findOne({ tokenHash, revokedAt: { $ne: null } });
    if (reused) {
      await RefreshSession.updateMany({ familyId: reused.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
      res.clearCookie('refreshToken', { path: '/api/auth' });
      throw new Unauthorized('Session reuse detected. Please sign in again.');
    }
    throw new Unauthorized('Session unavailable. Please sign in again.');
  }
  const user = await User.findById(session.user);
  if (!user || user.isBlocked || ['suspended', 'blocked', 'pending'].includes(user.accountStatus)) {
    await RefreshSession.updateMany({ familyId: session.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    res.clearCookie('refreshToken', { path: '/api/auth' });
    throw new Forbidden('Account is unavailable.');
  }
  const result = await issueSession(user, req, res, session.familyId);
  session.replacedBy = req.issuedRefreshTokenHash;
  await session.save();
  res.json({ success: true, ...result });
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.refreshToken;
  const session = rawToken
    ? await RefreshSession.findOneAndUpdate({ tokenHash: hashToken(rawToken), revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: false })
    : null;
  if (session?.user) req.app?.locals?.io?.in(`user:${session.user}`).disconnectSockets(true);
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true, message: 'Signed out.' });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, password, confirmPassword } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user || !(await bcrypt.compare(currentPassword || '', user.password))) throw new Unauthorized('Current password is incorrect.');
  if (!passwordIsValid(password) || password !== confirmPassword) throw new BadRequest(`${PASSWORD_POLICY_MESSAGE} Passwords must match.`);
  user.password = await bcrypt.hash(password, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  req.app?.locals?.io?.in(`user:${user._id}`).disconnectSockets(true);
  res.json({ success: true, message: 'Password updated. Sign in again on other devices.' });
});

const loginLogic = async (req, res, createSession, findUser = (email) => User.findOne({ email })) => {
  const { email, password } = req.body;
  if (!email || !password) throw new BadRequest('Email and password required');

  const user = await findUser(normalizeEmail(email));
  if (!user) throw new Unauthorized('Invalid credentials');

  if (user.isBlocked || ['blocked', 'suspended', 'pending'].includes(user.accountStatus)) throw new Unauthorized('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Unauthorized('Invalid credentials');

  if (user.emailVerified === false) throw new Unauthorized('Invalid credentials');
  let session;
  try {
    session = createSession ? await createSession(user, req, res) : await issueSession(user, req, res);
  } catch (error) {
    const details = error && typeof error === 'object'
      ? { type: error.constructor?.name || 'Object', name: typeof error.name === 'string' ? error.name : undefined, code: typeof error.code === 'string' || typeof error.code === 'number' ? error.code : undefined }
      : { type: typeof error };
    console.error(`[${req.requestId || 'n/a'}] Login session creation failed`, details);
    throw new InternalError('Unable to start a session. Please retry.');
  }
  res.json({ success: true, message: 'Login successful', ...session });
};

// Do not pass Express `next` into loginLogic's optional third createSession
// argument. The previous direct wrapper called next(user, req, res), causing
// error middleware to send 500 before loginLogic attempted its success JSON.
export const login = asyncHandler((req, res) => loginLogic(req, res));
export const createLoginHandler = ({ createSession, findUser = (email) => User.findOne({ email }) } = {}) => (req, res, next) => loginLogic(req, res, createSession, findUser).catch(next);

export const createForgotPasswordHandler = ({
  deliverCode = sendPasswordResetCode,
  generateCode = createOtp,
  findAccount = (email) => User.findOne({ email, emailVerified: { $ne: false }, accountStatus: { $in: ['active', null] } }),
  findPending = (email) => EmailVerification.findOne({ email, kind: 'password_reset' }),
  savePending = (email, update) => EmailVerification.findOneAndUpdate(
    { email, kind: 'password_reset' }, update, { upsert: true, new: true, setDefaultsOnInsert: true }
  ),
  removePending = (id, otpHash) => EmailVerification.deleteOne({ _id: id, otpHash })
} = {}) => asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) throw new BadRequest('Email is required');
  const user = await findAccount(email);
  let devMailPreviewToken;
  if (user) {
    const existing = await findPending(email);
    if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < env.otpResendCooldownSeconds * 1000) {
      return res.json({ success: true, message: 'If this address is eligible, password reset instructions can be requested.' });
    }
    const otp = generateCode();
    const otpHash = hashOtp(email, otp, 'password-reset');
    const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60_000);
    const entry = await savePending(email, { $set: { payload: { userId: user._id.toString() }, otpHash, authorizationHash: null, expiresAt, attempts: 0, lastSentAt: new Date() } });
    try {
      const delivery = await deliverCode({ to: normalizeEmail(user.email), code: otp, requestId: req.requestId });
      devMailPreviewToken = delivery.previewToken;
    } catch {
      try {
        await removePending(entry._id, otpHash);
      } catch {
        console.warn(JSON.stringify({ event: 'password_reset_otp_cleanup_failed', provider: env.emailProvider, ...(req.requestId ? { requestId: req.requestId } : {}) }));
      }
    }
  }
  res.json({ success: true, message: 'If this address is eligible, password reset instructions can be requested.', ...(devMailPreviewToken ? { devMailPreviewToken } : {}) });
});

export const forgotPassword = createForgotPasswordHandler();

const logPasswordResetOtpDiagnostic = (req, fields) => {
  console.info(JSON.stringify({
    event: 'password_reset_otp_verification',
    ...(req.requestId ? { requestId: req.requestId } : {}),
    ...fields
  }));
};

export const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const otpHash = hashOtp(email, otp, 'password-reset');
  const entry = await EmailVerification.findOne({ email, kind: 'password_reset', otpHash: { $ne: null } });
  const now = new Date();
  const purposeMatched = Boolean(entry && entry.kind === 'password_reset');
  const expiryValid = Boolean(entry && entry.expiresAt > now);
  const attemptsAllowed = Boolean(entry && entry.attempts < env.otpMaxAttempts);
  const hashMatched = Boolean(entry && secureHashEquals(entry.otpHash, otpHash));
  logPasswordResetOtpDiagnostic(req, {
    stage: 'record_validation',
    recordFound: Boolean(entry),
    purposeMatched,
    expiryValid,
    attemptsAllowed,
    hashMatched
  });
  if (!entry || !purposeMatched || !expiryValid || !attemptsAllowed || !hashMatched) {
    await EmailVerification.updateOne({ email, kind: 'password_reset', otpHash: { $ne: null }, attempts: { $lt: env.otpMaxAttempts }, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } });
    logPasswordResetOtpDiagnostic(req, { stage: 'record_rejected', consumed: false });
    throw new BadRequest('Invalid or expired verification code.');
  }
  const authorization = createOpaqueToken();
  const consumed = await EmailVerification.findOneAndUpdate(
    { _id: entry._id, otpHash, expiresAt: { $gt: new Date() }, attempts: { $lt: env.otpMaxAttempts } },
    { $set: { otpHash: null, authorizationHash: hashToken(authorization), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: env.otpMaxAttempts } },
    { new: false }
  );
  if (!consumed) {
    logPasswordResetOtpDiagnostic(req, { stage: 'consume', consumed: false });
    throw new BadRequest('Invalid or expired verification code.');
  }
  logPasswordResetOtpDiagnostic(req, { stage: 'consume', consumed: true });
  const user = await User.findOneAndUpdate(
    { _id: entry.payload.userId, emailVerified: { $ne: false }, accountStatus: { $in: ['active', null] } },
    { $set: { resetPasswordToken: hashToken(authorization), resetPasswordExpiresAt: new Date(Date.now() + 10 * 60_000), resetPasswordOtpVerifiedAt: new Date() } },
    { new: true }
  );
  if (!user) {
    await EmailVerification.deleteOne({ _id: entry._id });
    logPasswordResetOtpDiagnostic(req, { stage: 'authorization', accountEligible: false, consumed: true });
    throw new BadRequest('Invalid or expired verification code.');
  }
  await EmailVerification.deleteOne({ _id: entry._id, authorizationHash: hashToken(authorization) });
  logPasswordResetOtpDiagnostic(req, { stage: 'authorization', accountEligible: true, consumed: true });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, resetAuthorization: authorization, expiresInSeconds: 600 });
});

export const previewDevelopmentMail = asyncHandler(async (req, res) => {
  const captured = consumeDevelopmentMail(req.body?.previewToken);
  if (!captured) throw new BadRequest('Development mail preview is invalid, expired, or already used.');
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, ...captured });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new BadRequest('Token and new password are required');
  if (!passwordIsValid(password)) throw new BadRequest(PASSWORD_POLICY_MESSAGE);

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { resetPasswordToken: hashedToken, resetPasswordExpiresAt: { $gt: new Date() }, resetPasswordOtpVerifiedAt: { $gt: new Date(Date.now() - 10 * 60_000) } },
    { $set: { password: passwordHash, resetPasswordToken: null, resetPasswordExpiresAt: null, resetPasswordOtpVerifiedAt: null }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  if (!user) throw new BadRequest('Invalid or expired reset token');
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

  try {
    await sendPasswordChangedConfirmation({ to: user.email, requestId: req.requestId });
  } catch (error) {
    console.error(`[${req.requestId || 'n/a'}] Password change confirmation delivery failed`, { type: error?.constructor?.name || typeof error, status: Number.isInteger(error?.status) ? error.status : undefined });
  }

  res.json({ success: true, message: 'Password reset successful' });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .populate('savedListings', 'title price category availability images')
    .populate('bookmarkedNotes', 'title branch semester subject fileUrl');

  if (!user) throw new NotFound('User not found');

  const [listingsCount, notesCount, requestsCount, connectionsCount, messagesCount] = await Promise.all([
    Listing.countDocuments({ user: user._id }),
    Note.countDocuments({ user: user._id }),
    RequestPost.countDocuments({ user: user._id }),
    Connection.countDocuments({ $or: [{ requester: user._id, status: 'accepted' }, { recipient: user._id, status: 'accepted' }] }),
    Message.countDocuments({ $or: [{ sender: user._id }, { receiver: user._id }] })
  ]);

  res.json({
    success: true,
    data: sanitizeUser(user),
    savedListings: user.savedListings,
    bookmarkedNotes: user.bookmarkedNotes,
    stats: { listingsCount, notesCount, requestsCount, connectionsCount, messagesCount }
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'bio',
    'interests',
    'skills',
    'phoneNumber',
    'whatsappNumber',
    'contactVisibility'
  ];
  const protectedFields = ['email', 'enrollmentNumber', 'branch', 'department', 'semester', 'yearSemester', 'course', 'collegeName', 'role', 'accountType', 'emailVerified', 'verificationStatus', 'isVerifiedStudent', 'password', 'profilePicture'];
  const attemptedProtectedField = protectedFields.find((field) => field in req.body);
  if (attemptedProtectedField) throw new BadRequest(`${attemptedProtectedField} cannot be changed through profile editing.`);
  const updates = {};
  for (const key of allowedFields) if (key in req.body) updates[key] = req.body[key];
  if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim() || updates.name.length > 60)) throw new BadRequest('Name must be between 1 and 60 characters.');
  for (const field of ['bio', 'phoneNumber', 'whatsappNumber']) {
    if (updates[field] !== undefined && typeof updates[field] !== 'string') throw new BadRequest(`${field} must be text.`);
  }
  if (updates.bio?.length > 300) throw new BadRequest('Bio must be 300 characters or fewer.');
  if (updates.interests && (!Array.isArray(updates.interests) || updates.interests.length > 30)) throw new BadRequest('Interests must contain at most 30 values.');
  if (updates.skills && (!Array.isArray(updates.skills) || updates.skills.length > 30)) throw new BadRequest('Skills must contain at most 30 values.');
  if (updates.contactVisibility && !['connections', 'private'].includes(updates.contactVisibility)) throw new BadRequest('Invalid contact visibility.');
  for (const field of ['name', 'bio', 'phoneNumber', 'whatsappNumber']) if (typeof updates[field] === 'string') updates[field] = updates[field].trim();
  for (const field of ['interests', 'skills']) if (updates[field]) updates[field] = updates[field].map((value) => {
    if (typeof value !== 'string' || value.trim().length > 50) throw new BadRequest(`${field} values must be text with at most 50 characters.`);
    return value.trim();
  }).filter(Boolean);

  const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true, runValidators: true, strict: true });
  if (!user) throw new NotFound('User not found');

  res.json({ success: true, message: 'Profile updated', data: sanitizeUser(user) });
});

export const updateAvatar = asyncHandler(async (req, res) => {
  const profilePicture = await uploadAvatar(req.file, req.user.userId);
  const user = await User.findByIdAndUpdate(req.user.userId, { $set: { profilePicture } }, { new: true, runValidators: true });
  if (!user) throw new NotFound('User not found');
  res.json({ success: true, message: 'Profile image updated', data: sanitizeUser(user) });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user.userId;
  const [users, connections] = await Promise.all([
    User.find({ _id: { $ne: currentUserId }, isBlocked: { $ne: true }, accountStatus: { $nin: ['suspended', 'blocked', 'pending'] }, accountType: { $ne: 'alumni' } }).select(
      'name _id branch semester course yearSemester trustScore isVerifiedStudent profilePicture bio interests skills contactVisibility accountStatus'
    ).sort({ createdAt: -1 }).limit(500),
    Connection.find({ status: 'accepted', $or: [{ requester: currentUserId }, { recipient: currentUserId }] })
  ]);

  const connectedUserIds = new Set(
    connections.map((connection) =>
      connection.requester.toString() === currentUserId
        ? connection.recipient.toString()
        : connection.requester.toString()
    )
  );

  const data = users.map((student) => ({
    ...exposeContactForConnection(student, connectedUserIds.has(student._id.toString())),
    ...academicProfile(student),
    isConnected: connectedUserIds.has(student._id.toString())
  }));

  res.json({ success: true, data });
});
