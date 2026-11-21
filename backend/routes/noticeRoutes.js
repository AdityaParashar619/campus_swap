import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getNotice, listNotices } from '../controllers/noticeController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', listNotices);
router.get('/:id', getNotice);
export default router;
