import express from 'express';
import { createNote, getNotes, toggleBookmarkNote } from '../controllers/noteController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getNotes);
router.post('/', authMiddleware, createNote);
router.post('/:id/bookmark', authMiddleware, toggleBookmarkNote);

export default router;
