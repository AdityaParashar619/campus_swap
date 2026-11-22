import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getStudentLocation, listStudentLocations } from '../controllers/campusLocationController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', listStudentLocations);
router.get('/:id', getStudentLocation);

export default router;
