import express from 'express';
import { login, register, getAllUsers } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', authMiddleware, getAllUsers);

export default router;
