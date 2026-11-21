import express from 'express';
import { getMyAcademicResources } from '../controllers/academicController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/my-resources', authMiddleware, getMyAcademicResources);
export default router;
