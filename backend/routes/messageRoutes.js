import express from 'express';
import { getConversationSummaries, getMessages, sendMessage } from '../controllers/messageController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';
import { messageSendLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();

router.post('/', authMiddleware, messageSendLimiter, validateBody(['receiverId', 'text']), sendMessage);
router.get('/summaries', authMiddleware, getConversationSummaries);
router.get('/:userId', authMiddleware, getMessages);

export default router;
