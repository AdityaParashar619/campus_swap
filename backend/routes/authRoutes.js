import express from 'express';
import {
  forgotPassword,
  getAllUsers,
  getMe,
  login,
  logout,
  refreshSession,
  registerAlumni,
  registerStudent,
  resendStudentOtp,
  resetPassword,
  updatePassword,
  updateProfile,
  verifyAlumniEmail,
  verifyStudentEmail
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateAuthPayload, validateBody, validatePasswordResetPayload } from '../middleware/validateMiddleware.js';
import { authAttemptLimiter } from '../middleware/securityMiddleware.js';
import { env } from '../config/env.js';

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get('origin');
  const allowed = env.frontendUrl.split(',').map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
  next();
};

const router = express.Router();

router.post('/register', authAttemptLimiter, registerStudent);
router.post('/register/student', authAttemptLimiter, registerStudent);
router.post('/register/alumni', authAttemptLimiter, registerAlumni);
router.post('/verify-alumni-email', authAttemptLimiter, verifyAlumniEmail);
router.post('/verify-email', authAttemptLimiter, verifyStudentEmail);
router.post('/resend-otp', authAttemptLimiter, resendStudentOtp);
router.post('/login', authAttemptLimiter, validateBody(['email', 'password']), validateAuthPayload('login'), login);
router.post('/refresh', requireTrustedOrigin, authAttemptLimiter, refreshSession);
router.post('/logout', requireTrustedOrigin, logout);
router.post('/forgot-password', authAttemptLimiter, validateBody(['email']), forgotPassword);
router.post('/reset-password', authAttemptLimiter, validatePasswordResetPayload, resetPassword);

router.get('/users', authMiddleware, getAllUsers);
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updateProfile);
router.patch('/me/password', authMiddleware, updatePassword);

export default router;
