import express from 'express';
import { createIssue, getMyIssue, getMyIssueEvidence, listMyIssues } from '../controllers/campusIssueController.js';
import { campusIssueEvidenceUpload } from '../middleware/campusIssueEvidenceUpload.js';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { creationLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();
router.use(authMiddleware, requireRole('student'));
router.post('/', creationLimiter, campusIssueEvidenceUpload, createIssue);
router.get('/mine', listMyIssues);
router.get('/:id', getMyIssue);
router.get('/:id/evidence/:photoId', getMyIssueEvidence);

export default router;
