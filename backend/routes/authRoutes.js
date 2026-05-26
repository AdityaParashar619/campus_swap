import express from 'express';
import {
  forgotPassword,
  getAllUsers,
  getMe,
  login,
  register,
  resetPassword,
  updateProfile
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateAuthPayload, validateBody } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.post('/register', validateBody(['name', 'email', 'enrollmentNumber', 'password']), validateAuthPayload('register'), register);
router.post('/login', validateBody(['email', 'password']), validateAuthPayload('login'), login);
router.post('/forgot-password', validateBody(['email']), forgotPassword);
router.post('/reset-password', validateBody(['token', 'password']), resetPassword);

router.get('/users', authMiddleware, getAllUsers);
router.get('/me', authMiddleware, getMe);
router.patch('/me', authMiddleware, updateProfile);

export default router;
