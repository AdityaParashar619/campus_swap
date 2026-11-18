import express from 'express';
import {
  createListing,
  addFavoriteListing,
  deleteListing,
  getFavoriteStatuses,
  getListingById,
  getListings,
  getMyListings,
  getSavedListings,
  removeFavoriteListing,
  toggleFavoriteListing,
  updateListing
} from '../controllers/listingController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateMiddleware.js';
import { deletePendingProductImage, uploadProductImages } from '../controllers/productImageController.js';
import { productImageUploadMiddleware } from '../middleware/productImageUploadMiddleware.js';
import { creationLimiter, productImageUploadLimiter } from '../middleware/securityMiddleware.js';

const router = express.Router();

router.get('/', getListings);
router.get('/mine', authMiddleware, getMyListings);
router.get('/saved', authMiddleware, getSavedListings);
router.post('/favorites/status', authMiddleware, getFavoriteStatuses);
router.post('/images', authMiddleware, productImageUploadLimiter, productImageUploadMiddleware, uploadProductImages);
router.delete('/images/:id', authMiddleware, deletePendingProductImage);
router.post('/', authMiddleware, creationLimiter, validateBody(['title']), createListing);
router.get('/:id', getListingById);
router.patch('/:id', authMiddleware, updateListing);
router.delete('/:id', authMiddleware, deleteListing);
router.post('/:id/favorite', authMiddleware, toggleFavoriteListing);
router.put('/:id/favorite', authMiddleware, addFavoriteListing);
router.delete('/:id/favorite', authMiddleware, removeFavoriteListing);

export default router;
