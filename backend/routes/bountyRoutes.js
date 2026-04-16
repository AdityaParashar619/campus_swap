import express from 'express';
import { createBounty, getBounties } from '../controllers/bountyController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getBounties);
router.post('/', authMiddleware, createBounty);

export default router;
