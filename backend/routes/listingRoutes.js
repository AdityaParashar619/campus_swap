import express from 'express';
import {
  createListing,
  deleteListing,
  getListings,
  toggleFavoriteListing,
  updateListing
} from '../controllers/listingController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';

const router = express.Router();

router.get('/', getListings);
router.post('/', authMiddleware, validateBody(['title']), createListing);
router.patch('/:id', authMiddleware, updateListing);
router.delete('/:id', authMiddleware, deleteListing);
router.post('/:id/favorite', authMiddleware, toggleFavoriteListing);

export default router;
