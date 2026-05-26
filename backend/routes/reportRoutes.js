import express from 'express';
import { createReport, getMyReports, getOpenReports } from '../controllers/reportController.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/mine', authMiddleware, getMyReports);
router.get('/open', authMiddleware, requireRole('admin'), getOpenReports);
router.post('/', authMiddleware, createReport);

export default router;
