import express from 'express';
import {
  forgotPassword,
  getAllUsers,
  getMe,
  login,
  previewDevelopmentMail,
  logout,
  refreshSession,
  registerAlumni,
  registerStudent,
  resendStudentOtp,
  resetPassword,
  updatePassword,
  updateProfile,
  verifyAlumniEmail,
  verifyPasswordResetOtp,
  verifyStudentEmail
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateAuthPayload, validateBody, validatePasswordResetPayload } from '../middleware/validateMiddleware.js';
import { authAccountAttemptLimiter, authAttemptLimiter, refreshAttemptLimiter } from '../middleware/securityMiddleware.js';
import { env } from '../config/env.js';

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('origin');
  const allowed = env.frontendUrl.split(',').map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  next();
};

const router = express.Router();

router.post('/register', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerStudent);
router.post('/register/student', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerStudent);
router.post('/register/alumni', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerAlumni);
router.post('/verify-alumni-email', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, verifyAlumniEmail);
router.post('/verify-email', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, verifyStudentEmail);
router.post('/resend-otp', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, resendStudentOtp);
router.post('/login', authAttemptLimiter, validateBody(['email', 'password']), authAccountAttemptLimiter, validateAuthPayload('login'), login);
router.post('/refresh', requireTrustedOrigin, refreshAttemptLimiter, refreshSession);
router.post('/logout', requireTrustedOrigin, logout);
router.post('/forgot-password', authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, forgotPassword);
router.post('/verify-reset-otp', authAttemptLimiter, validateBody(['email', 'otp']), authAccountAttemptLimiter, verifyPasswordResetOtp);
router.post('/reset-password', authAttemptLimiter, validatePasswordResetPayload, resetPassword);
router.post('/dev-mail-preview', authAttemptLimiter, validateBody(['previewToken']), previewDevelopmentMail);

router.get('/users', authMiddleware, getAllUsers);
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updateProfile);
router.patch('/me/password', authMiddleware, updatePassword);

export default router;
