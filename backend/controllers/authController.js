import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorMiddleware.js';
import { env } from '../config/env.js';
import { BadRequest, NotFound, Unauthorized } from '../utils/AppError.js';
import { createResetToken, signAuthToken } from '../utils/auth.js';
import Connection from '../models/Connection.js';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import Note from '../models/Note.js';
import RequestPost from '../models/RequestPost.js';
import User from '../models/User.js';

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  enrollmentNumber: user.enrollmentNumber,
  role: user.role,
  profilePicture: user.profilePicture,
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

export const register = asyncHandler(async (req, res) => {
  const { name, email, enrollmentNumber, password } = req.body;
  if (!name || !email || !enrollmentNumber || !password) throw new BadRequest('All fields required');

  const existingUser = await User.findOne({ $or: [{ email }, { enrollmentNumber }] });
  if (existingUser) throw new BadRequest('Email or enrollment number already exists');

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    enrollmentNumber,
    password: await bcrypt.hash(password, 12)
  });

  const token = signAuthToken({ userId: user._id.toString(), email: user.email, role: user.role });
  res.status(201).json({ success: true, message: 'User registered successfully', token, user: sanitizeUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new BadRequest('Email and password required');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new Unauthorized('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Unauthorized('Invalid credentials');

  const token = signAuthToken({ userId: user._id.toString(), email: user.email, role: user.role });
  res.json({ success: true, message: 'Login successful', token, user: sanitizeUser(user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new BadRequest('Email is required');

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.json({ success: true, message: 'If this email exists, reset instructions have been generated.' });
  }

  const { rawToken, hashedToken, expiresAt } = createResetToken();
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpiresAt = new Date(expiresAt);
  await user.save();

  const resetUrl = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  res.json({ success: true, message: 'Password reset token generated.', data: { resetUrl } });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new BadRequest('Token and new password are required');

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpiresAt: { $gt: new Date() } });
  if (!user) throw new BadRequest('Invalid or expired reset token');

  user.password = await bcrypt.hash(password, 12);
  user.resetPasswordToken = null;
  user.resetPasswordExpiresAt = null;
  await user.save();

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
  const allowedFields = ['name', 'collegeName', 'course', 'yearSemester', 'bio', 'interests', 'skills', 'profilePicture'];
  const updates = {};
  for (const key of allowedFields) if (key in req.body) updates[key] = req.body[key];

  const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true, runValidators: true });
  if (!user) throw new NotFound('User not found');

  res.json({ success: true, message: 'Profile updated', data: sanitizeUser(user) });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.userId } }).select(
    'name email _id course yearSemester trustScore isVerifiedStudent profilePicture collegeName bio interests skills'
  );
  res.json({ success: true, data: users });
});
