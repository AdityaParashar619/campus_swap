import express from 'express';
import { createReport, getMyReports, getOpenReports } from '../controllers/reportController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/mine', authMiddleware, getMyReports);
router.get('/open', authMiddleware, requirePermission('grievances:review'), getOpenReports);
router.post('/', authMiddleware, createReport);

export default router;
