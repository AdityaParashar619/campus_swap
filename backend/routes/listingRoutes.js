import express from 'express';
import { createListing, deleteListing, getListings } from '../controllers/listingController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getListings);
router.post('/', authMiddleware, createListing);
router.delete('/:id', authMiddleware, deleteListing);

export default router;
