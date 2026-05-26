import express from 'express';
import {
  createRequestPost,
  getRequestPosts,
  respondToRequestPost,
  updateRequestPostStatus
} from '../controllers/requestController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getRequestPosts);
router.post('/', authMiddleware, createRequestPost);
router.post('/:id/responses', authMiddleware, respondToRequestPost);
router.patch('/:id/status', authMiddleware, updateRequestPostStatus);

export default router;
