import { asyncHandler } from '../middleware/errorMiddleware.js';
import { cleanupExpiredProductImages, deleteOwnedPendingImage, serializeProductImage, uploadProductFiles } from '../services/productImageService.js';

export const uploadProductImages = asyncHandler(async (req, res) => {
  void cleanupExpiredProductImages().catch(() => undefined);
  const images = await uploadProductFiles(req.files, req.user.userId);
  res.status(201).json({ success: true, message: 'Images uploaded', data: images.map(serializeProductImage) });
});

export const deletePendingProductImage = asyncHandler(async (req, res) => {
  await deleteOwnedPendingImage(req.params.id, req.user.userId);
  res.json({ success: true, message: 'Image removed' });
});
