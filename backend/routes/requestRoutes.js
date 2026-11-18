import express from 'express';
import {
  createRequestPost,
  getRequestPosts,
  respondToRequestPost,
  updateRequestPostStatus
} from '../controllers/requestController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { creationLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();

router.get('/', getRequestPosts);
router.post('/', authMiddleware, creationLimiter, createRequestPost);
router.post('/:id/responses', authMiddleware, creationLimiter, respondToRequestPost);
router.patch('/:id/status', authMiddleware, updateRequestPostStatus);

export default router;
