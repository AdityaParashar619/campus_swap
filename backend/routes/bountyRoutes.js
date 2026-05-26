import express from 'express';
import { createBounty, getBounties } from '../controllers/bountyController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.get('/', getBounties);
router.post('/', authMiddleware, validateBody(['title']), createBounty);

export default router;
