import express from 'express';
import {
  getConnectionSuggestions,
  getMyConnections,
  getStudentRelationship,
  respondToConnectionRequest,
  sendConnectionRequest
} from '../controllers/connectionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { creationLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getMyConnections);
router.get('/suggestions', authMiddleware, getConnectionSuggestions);
router.get('/students/:userId', authMiddleware, getStudentRelationship);
router.post('/', authMiddleware, creationLimiter, sendConnectionRequest);
router.patch('/:id/respond', authMiddleware, respondToConnectionRequest);

export default router;
