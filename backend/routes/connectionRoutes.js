import express from 'express';
import {
  getConnectionSuggestions,
  getMyConnections,
  respondToConnectionRequest,
  sendConnectionRequest
} from '../controllers/connectionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', authMiddleware, getMyConnections);
router.get('/suggestions', authMiddleware, getConnectionSuggestions);
router.post('/', authMiddleware, sendConnectionRequest);
router.patch('/:id/respond', authMiddleware, respondToConnectionRequest);

export default router;
