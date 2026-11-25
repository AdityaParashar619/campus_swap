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
  updateAvatar,
  updateProfile,
  verifyAlumniEmail,
  verifyPasswordResetOtp,
  verifyStudentEmail
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateAuthPayload, validateBody, validatePasswordResetPayload } from '../middleware/validateMiddleware.js';
import { authAccountAttemptLimiter, authAttemptLimiter, productImageUploadLimiter, refreshAttemptLimiter } from '../middleware/securityMiddleware.js';
import { env } from '../config/env.js';
import { avatarUploadMiddleware } from '../middleware/avatarUploadMiddleware.js';

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('origin');
  if (!env.frontendOrigins.includes(origin)) return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  next();
};

const router = express.Router();

const requireEmailFlows = (_req, res, next) => {
  if (!env.demoMode) return next();
  res.status(403).json({ success: false, message: 'Registration and password reset are unavailable in the synthetic demo. Use an invited demo account.' });
};

router.get('/capabilities', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ emailFlowsEnabled: !env.demoMode });
});

router.post('/register', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerStudent);
router.post('/register/student', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerStudent);
router.post('/register/alumni', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, registerAlumni);
router.post('/verify-alumni-email', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, verifyAlumniEmail);
router.post('/verify-email', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, verifyStudentEmail);
router.post('/resend-otp', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, resendStudentOtp);
router.post('/login', authAttemptLimiter, validateBody(['email', 'password']), authAccountAttemptLimiter, validateAuthPayload('login'), login);
router.post('/refresh', requireTrustedOrigin, refreshAttemptLimiter, refreshSession);
router.post('/logout', requireTrustedOrigin, logout);
router.post('/forgot-password', requireEmailFlows, authAttemptLimiter, validateBody(['email']), authAccountAttemptLimiter, forgotPassword);
router.post('/verify-reset-otp', requireEmailFlows, authAttemptLimiter, validateBody(['email', 'otp']), authAccountAttemptLimiter, verifyPasswordResetOtp);
router.post('/reset-password', requireEmailFlows, authAttemptLimiter, validatePasswordResetPayload, resetPassword);
router.post('/dev-mail-preview', requireEmailFlows, authAttemptLimiter, validateBody(['previewToken']), previewDevelopmentMail);

router.get('/users', authMiddleware, getAllUsers);
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updateProfile);
router.post('/me/avatar', authMiddleware, productImageUploadLimiter, avatarUploadMiddleware, updateAvatar);
router.patch('/me/password', authMiddleware, updatePassword);

export default router;
