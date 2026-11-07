import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { env } from '../config/env.js';
import { BadRequest, Conflict, Forbidden, NotFound, Unauthorized } from '../utils/AppError.js';
import { createOpaqueToken, createOtp, createResetToken, hashOtp, hashToken, signAuthToken, secureHashEquals } from '../utils/auth.js';
import { getPermissions } from '../utils/permissions.js';
import EmailVerification from '../models/EmailVerification.js';
import RefreshSession from '../models/RefreshSession.js';
import AlumniVerification from '../models/AlumniVerification.js';
import AuditLog from '../models/AuditLog.js';
import { sendPasswordReset, sendVerificationCode } from '../utils/emailProvider.js';
import Connection from '../models/Connection.js';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import Note from '../models/Note.js';
import RequestPost from '../models/RequestPost.js';
import User from '../models/User.js';
import { exposeContactForConnection } from '../utils/connections.js';

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
  collegeName: user.collegeName,
  course: user.course,
  yearSemester: user.yearSemester,
  bio: user.bio,
  interests: user.interests,
  skills: user.skills,
  trustScore: user.trustScore,
  isVerifiedStudent: user.isVerifiedStudent,
  createdAt: user.createdAt
});

const passwordIsValid = (password) => typeof password === 'string' && password.length >= 12 && password.length <= 128;
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
export const validateCollegeEmail = (email, { allowedDomains = env.allowedCollegeDomains, production = env.nodeEnv === 'production' } = {}) => {
  const domain = email.split('@')[1];
  if (!allowedDomains.length) {
    if (production) throw new Forbidden('Student registration is unavailable until the institution email domain is configured.');
    return;
  }
  if (!allowedDomains.includes(domain)) throw new BadRequest('Use an approved college email address.');
};
const validateInstitutionField = (value, allowed, field) => {
  if (allowed.length && !allowed.includes(value)) throw new BadRequest(`Invalid ${field}.`);
};
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

const registerStudentLogic = async (req, res, deliverCode, isDuplicate = (query) => User.exists(query), savePending = (filter, update, options) => EmailVerification.findOneAndUpdate(filter, update, options), removePending = (id) => EmailVerification.deleteOne({ _id: id }), domainPolicy = validateCollegeEmail, markSent = (id) => EmailVerification.updateOne({ _id: id }, { $set: { lastSentAt: new Date() } })) => {
  const { name, email: rawEmail, enrollmentNumber, department, branch, semester, phoneNumber, password, confirmPassword, profilePicture, bio, skills, interests } = req.body;
  const email = normalizeEmail(rawEmail);
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !enrollmentNumber?.trim() || !department?.trim() || !branch?.trim() || !semester || !phoneNumber?.trim()) {
    throw new BadRequest('Complete all required student fields.');
  }
  if (!passwordIsValid(password)) throw new BadRequest('Password must be 12 to 128 characters.');
  if (password !== confirmPassword) throw new BadRequest('Passwords do not match.');
  domainPolicy(email);
  if (env.enrollmentPattern && !new RegExp(env.enrollmentPattern).test(enrollmentNumber)) throw new BadRequest('Enrollment number format is invalid.');
  validateInstitutionField(department, env.institutionDepartments, 'department');
  validateInstitutionField(branch, env.institutionBranches, 'branch');
  validateInstitutionField(String(semester), env.institutionSemesters, 'semester/year');
  if (await isDuplicate({ $or: [{ email }, { enrollmentNumber: enrollmentNumber.trim() }] })) {
    return res.status(202).json({ success: true, message: 'If registration details are eligible, a verification code has been sent.' });
  }
  const pendingEntry = await isDuplicate({ email, kind: 'student' }, 'pendingEntry');
  if (pendingEntry?.lastSentAt && Date.now() - pendingEntry.lastSentAt.getTime() < 60_000) return res.status(202).json({ success: true, message: 'If registration details are eligible, a verification code has been sent.' });
  const pendingEnrollment = await isDuplicate({ kind: 'student', 'payload.enrollmentNumber': enrollmentNumber.trim(), email: { $ne: email } }, 'pending');
  if (pendingEnrollment) return res.status(202).json({ success: true, message: 'If registration details are eligible, a verification code has been sent.' });

  const otp = createOtp();
  const payload = {
    name: name.trim(), email, enrollmentNumber: enrollmentNumber.trim(), department: department.trim(), branch: branch.trim(),
    semester: String(semester), yearSemester: String(semester), phoneNumber: phoneNumber.trim(),
    password: await bcrypt.hash(password, 12), profilePicture: profilePicture || '', bio: bio || '', skills: skills || [], interests: interests || []
  };
  const entry = await savePending(
    { email, kind: 'student' },
    { $set: { payload, otpHash: hashOtp(email, otp), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0, lastSentAt: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  try {
    const delivery = await deliverCode({ to: email, code: otp });
    await markSent(entry._id);
    res.status(202).json({ success: true, message: 'If registration details are eligible, a verification code has been sent.', ...(delivery.previewCode ? { devOtp: delivery.previewCode } : {}), expiresAt: entry.expiresAt });
  } catch (error) {
    await removePending(entry._id);
    throw new BadRequest('Email delivery is not configured. Contact the institution administrator.');
  }
};

export const registerStudent = asyncHandler((req, res) => registerStudentLogic(req, res, sendVerificationCode));
export const createRegisterStudentHandler = ({ deliverCode = sendVerificationCode, isDuplicate = (query, collection) => collection === 'pending' ? EmailVerification.exists(query) : collection === 'pendingEntry' ? EmailVerification.findOne(query) : User.exists(query), savePending = (filter, update, options) => EmailVerification.findOneAndUpdate(filter, update, options), removePending = (id) => EmailVerification.deleteOne({ _id: id }), domainPolicy = (email) => validateCollegeEmail(email, { allowedDomains: [], production: false }), markSent = (id) => EmailVerification.updateOne({ _id: id }, { $set: { lastSentAt: new Date() } }) } = {}) => (req, res) => registerStudentLogic(req, res, deliverCode, isDuplicate, savePending, removePending, domainPolicy, markSent);

export const verifyStudentEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();
  const otpHash = hashOtp(email, otp);
  const entry = await EmailVerification.findOne({ email, kind: 'student', expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } });
  const valid = entry && secureHashEquals(entry.otpHash, otpHash);
  const claimed = valid ? await EmailVerification.findOneAndUpdate(
    { _id: entry._id, otpHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $set: { attempts: 5 } },
    { new: false }
  ) : null;
  if (!claimed) {
    await EmailVerification.updateOne({ email, kind: 'student', attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } }, { $inc: { attempts: 1 } });
    throw new BadRequest('Invalid or expired verification code.');
  }
  let user;
  try {
    user = await User.create({ ...claimed.payload, accountType: 'student', role: 'student', emailVerified: true, verificationStatus: 'verified', verificationMethod: 'college_email_otp', accountStatus: 'active', isVerifiedStudent: true });
  } catch (error) {
    if (error.code === 11000) {
      await EmailVerification.deleteOne({ _id: claimed._id });
      throw new Conflict('Email or enrollment number already exists.');
    }
    throw error;
  }
  await EmailVerification.deleteOne({ _id: claimed._id, attempts: 5 });
  const session = await issueSession(user, req, res);
  res.status(201).json({ success: true, message: 'Email verified.', ...session });
});

export const resendStudentOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const entry = await EmailVerification.findOne({ email, kind: 'student' });
  if (!entry) return res.json({ success: true, message: 'If a pending registration exists, a new code has been sent.' });
  if (entry.lastSentAt && Date.now() - entry.lastSentAt.getTime() < 60_000) throw new BadRequest('Please wait before requesting another code.');
  const otp = createOtp();
  const oldState = { otpHash: entry.otpHash, expiresAt: entry.expiresAt, attempts: entry.attempts, lastSentAt: entry.lastSentAt };
  entry.otpHash = hashOtp(email, otp);
  entry.expiresAt = new Date(Date.now() + 10 * 60_000);
  entry.attempts = 0;
  await entry.save();
  let delivery;
  try {
    delivery = await sendVerificationCode({ to: email, code: otp });
  } catch (error) {
    Object.assign(entry, oldState);
    await entry.save();
    throw new BadRequest('Email delivery is temporarily unavailable. Please retry later.');
  }
  entry.lastSentAt = new Date();
  await entry.save();
  res.json({ success: true, message: 'If a pending registration exists, a new code has been sent.', ...(delivery.previewCode ? { devOtp: delivery.previewCode } : {}) });
});

export const registerAlumni = asyncHandler(async (req, res) => {
  const { name, email: rawEmail, graduationYear, department, branch, previousEnrollmentNumber = '', company = '', jobTitle = '', password, confirmPassword } = req.body;
  const email = normalizeEmail(rawEmail);
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email) || !Number.isInteger(Number(graduationYear)) || !department?.trim() || !branch?.trim()) throw new BadRequest('Complete all required alumni fields.');
  if (!passwordIsValid(password) || password !== confirmPassword) throw new BadRequest('Use a 12 to 128 character password and confirm it correctly.');
  if (await User.exists({ email })) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  const existingApplication = await AlumniVerification.findOne({ email });
  if (existingApplication) {
    if (existingApplication.status !== 'email_pending') return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
    if (existingApplication.emailLastSentAt && Date.now() - existingApplication.emailLastSentAt.getTime() < 60_000) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  }
  const rawVerificationToken = createOpaqueToken();
  const payload = { name: name.trim(), email, password: await bcrypt.hash(password, 12), graduationYear: Number(graduationYear), department, branch, previousEnrollmentNumber, company, jobTitle };
  let verification;
  try {
    verification = await AlumniVerification.findOneAndUpdate(
      existingApplication
        ? { email, status: 'email_pending', emailLastSentAt: { $lte: new Date(Date.now() - 60_000) } }
        : { email },
      { $set: { email, payload, emailTokenHash: hashToken(rawVerificationToken), emailTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60_000), emailLastSentAt: new Date(), status: 'email_pending', graduationYear: Number(graduationYear), department, branch, previousEnrollmentNumber, company, jobTitle } },
      { upsert: !existingApplication, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error.code === 11000) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
    throw error;
  }
  if (!verification) return res.status(202).json({ success: true, message: 'If this address is eligible, verification instructions have been sent.' });
  try {
    await sendPasswordReset({ to: email, resetUrl: `${env.frontendUrl.split(',')[0]}/verify-alumni?email=${encodeURIComponent(email)}&token=${encodeURIComponent(rawVerificationToken)}`, template: 'campusswap-alumni-email-verification' });
  } catch (error) {
    if (existingApplication) {
      await AlumniVerification.updateOne({ _id: verification._id, emailTokenHash: hashToken(rawVerificationToken) }, { $set: { emailTokenHash: null, emailTokenExpiresAt: null, emailLastSentAt: existingApplication.emailLastSentAt || null, payload: existingApplication.payload || null } });
    } else {
      await AlumniVerification.deleteOne({ _id: verification._id, emailTokenHash: hashToken(rawVerificationToken) });
    }
    throw new BadRequest('Email delivery is not configured. Contact the institution administrator.');
  }
  res.status(202).json({ success: true, message: 'Alumni verification request submitted for institutional review.', verificationStatus: 'pending' });
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
  if (rawToken) await RefreshSession.updateOne({ tokenHash: hashToken(rawToken), revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ success: true, message: 'Signed out.' });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, password, confirmPassword } = req.body;
  const user = await User.findById(req.user.userId);
  if (!user || !(await bcrypt.compare(currentPassword || '', user.password))) throw new Unauthorized('Current password is incorrect.');
  if (!passwordIsValid(password) || password !== confirmPassword) throw new BadRequest('New password must be 12 to 128 characters and confirmed.');
  user.password = await bcrypt.hash(password, 12);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.json({ success: true, message: 'Password updated. Sign in again on other devices.' });
});

const loginLogic = async (req, res, createSession, findUser = (email) => User.findOne({ email })) => {
  const { email, password } = req.body;
  if (!email || !password) throw new BadRequest('Email and password required');

  const user = await findUser(email.toLowerCase());
  if (!user) throw new Unauthorized('Invalid credentials');

  if (user.isBlocked || ['blocked', 'suspended', 'pending'].includes(user.accountStatus)) throw new Unauthorized('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Unauthorized('Invalid credentials');

  if (user.emailVerified === false) throw new Unauthorized('Invalid credentials');
  const session = createSession ? await createSession(user, req, res) : await issueSession(user, req, res);
  res.json({ success: true, message: 'Login successful', ...session });
};

export const login = asyncHandler(loginLogic);
export const createLoginHandler = ({ createSession, findUser = (email) => User.findOne({ email }) } = {}) => (req, res, next) => loginLogic(req, res, createSession, findUser).catch(next);

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new BadRequest('Email is required');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const { rawToken, hashedToken, expiresAt } = createResetToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpiresAt = new Date(expiresAt);
    await user.save();
    try {
      const delivery = await sendPasswordReset({ to: user.email, resetUrl: `${env.frontendUrl.split(',')[0]}/reset-password?token=${rawToken}` });
      void delivery;
    } catch (error) {
      console.error(`Password reset delivery failed for request ${req.requestId}: ${error.message}`);
    }
  }
  res.json({ success: true, message: 'If this email exists, reset instructions have been sent.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new BadRequest('Token and new password are required');
  if (!passwordIsValid(password)) throw new BadRequest('Password must be 12 to 128 characters.');

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    { resetPasswordToken: hashedToken, resetPasswordExpiresAt: { $gt: new Date() } },
    { $set: { password: passwordHash, resetPasswordToken: null, resetPasswordExpiresAt: null }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  if (!user) throw new BadRequest('Invalid or expired reset token');
  await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });

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
    'collegeName',
    'course',
    'yearSemester',
    'bio',
    'interests',
    'skills',
    'profilePicture',
    'phoneNumber',
    'whatsappNumber',
    'contactVisibility'
  ];
  const updates = {};
  for (const key of allowedFields) if (key in req.body) updates[key] = req.body[key];
  if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim() || updates.name.length > 60)) throw new BadRequest('Name must be between 1 and 60 characters.');
  for (const field of ['bio', 'collegeName', 'course', 'yearSemester', 'profilePicture', 'phoneNumber', 'whatsappNumber']) {
    if (updates[field] !== undefined && typeof updates[field] !== 'string') throw new BadRequest(`${field} must be text.`);
  }
  if (updates.bio?.length > 300) throw new BadRequest('Bio must be 300 characters or fewer.');
  if (typeof updates.profilePicture === 'string' && updates.profilePicture.length > 700_000) throw new BadRequest('Profile picture must be smaller than 512 KB or use an external image URL.');
  if (updates.interests && (!Array.isArray(updates.interests) || updates.interests.length > 30)) throw new BadRequest('Interests must contain at most 30 values.');
  if (updates.skills && (!Array.isArray(updates.skills) || updates.skills.length > 30)) throw new BadRequest('Skills must contain at most 30 values.');

  const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true, runValidators: true, strict: true });
  if (!user) throw new NotFound('User not found');

  res.json({ success: true, message: 'Profile updated', data: sanitizeUser(user) });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user.userId;
  const [users, connections] = await Promise.all([
    User.find({ _id: { $ne: currentUserId }, isBlocked: { $ne: true }, accountStatus: { $nin: ['suspended', 'blocked', 'pending'] }, accountType: { $ne: 'alumni' } }).select(
      'name _id course yearSemester trustScore isVerifiedStudent profilePicture collegeName bio interests skills contactVisibility accountStatus'
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
    isConnected: connectedUserIds.has(student._id.toString())
  }));

  res.json({ success: true, data });
});
