import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { env } from '../config/env.js';
import ProductImage from '../models/ProductImage.js';
import { BadRequest, Forbidden, ServiceUnavailable } from '../utils/AppError.js';
import { assetFolder, makeScopedAssetId, matchesScopedUpload, ownsScopedAsset, usesScopedAssets } from '../utils/cloudinaryNamespace.js';

const canModifyImage = (image) => !usesScopedAssets() || ownsScopedAsset(image.publicId, 'products', image.owner);
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 12000;
const MAX_PIXELS = 40_000_000;
const allowedFormats = new Set(['jpeg', 'png', 'webp']);
const uploadUnavailable = (message) => { const error = new ServiceUnavailable(message); error.expose = true; return error; };

export const isCloudinaryConfigured = () => Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

const configureCloudinary = () => {
  if (!isCloudinaryConfigured()) throw uploadUnavailable('Product image uploads are not configured.');
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
};

export const inspectImage = async (file) => {
  if (!file?.buffer?.length) throw new BadRequest('Image file is empty.');
  let metadata;
  try {
    metadata = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  } catch {
    throw new BadRequest('Image content is malformed or exceeds safe dimensions.');
  }
  const format = metadata.format === 'jpg' ? 'jpeg' : metadata.format;
  if (!allowedFormats.has(format)) throw new BadRequest('Only JPEG, PNG, and WebP images are supported.');
  if (!metadata.width || !metadata.height || metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    throw new BadRequest(`Images must be at least ${MIN_DIMENSION} × ${MIN_DIMENSION} pixels.`);
  }
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || metadata.width * metadata.height > MAX_PIXELS) {
    throw new BadRequest('Image dimensions are too large.');
  }
  const declared = String(file.mimetype || '').toLowerCase();
  const expectedMime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  if (declared !== expectedMime) throw new BadRequest('Image type does not match its file content.');
  return { format, width: metadata.width, height: metadata.height };
};

const uploadBuffer = (buffer, publicId) => new Promise((resolve, reject) => {
  configureCloudinary();
  const stream = cloudinary.uploader.upload_stream({
    resource_type: 'image', ...(!usesScopedAssets() && { folder: assetFolder('products') }), public_id: publicId, overwrite: false,
    type: 'upload', timeout: 30_000
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(buffer);
});

export const uploadProductFiles = async (files, ownerId) => {
  if (!Array.isArray(files) || files.length === 0) throw new BadRequest('Select at least one image.');
  if (files.length > env.productImageMaxCount) throw new BadRequest(`A maximum of ${env.productImageMaxCount} images is allowed.`);
  configureCloudinary();
  const created = [];
  try {
    for (const file of files) {
      if (!Number.isFinite(file?.size) || file.size < 1 || file.size > env.productImageMaxSizeBytes) {
        throw new BadRequest(`Each image must be ${env.productImageMaxSizeBytes / 1024 / 1024} MB or smaller.`);
      }
      const metadata = await inspectImage(file);
      const publicId = usesScopedAssets() ? makeScopedAssetId('products', ownerId) : ownerId + '-' + crypto.randomUUID();
      let result;
      try { result = await uploadBuffer(file.buffer, publicId); }
      catch { throw uploadUnavailable('Image upload service is temporarily unavailable.'); }
      if (!result?.secure_url?.startsWith('https://') || !result.public_id ||
          (usesScopedAssets() && !matchesScopedUpload(result, publicId))) throw uploadUnavailable('Image upload service returned an invalid response.');
      const image = await ProductImage.create({
        secureUrl: result.secure_url, publicId: result.public_id, assetId: result.asset_id || '', owner: ownerId,
        format: metadata.format, width: metadata.width, height: metadata.height, bytes: result.bytes || file.size,
        status: 'pending', expiresAt: new Date(Date.now() + env.productImagePendingTtlMs)
      });
      created.push(image);
    }
    return created;
  } catch (error) {
    await Promise.allSettled(created.map(async (image) => {
      if (!canModifyImage(image)) return;
      try { await cloudinary.uploader.destroy(image.publicId, { resource_type: 'image', type: 'upload', invalidate: true }); }
      finally { await ProductImage.deleteOne({ _id: image._id }); }
    }));
    throw error;
  }
};

export const serializeProductImage = (image) => ({
  id: image._id.toString(), url: image.secureUrl, width: image.width, height: image.height, format: image.format
});

export const reserveListingImages = async ({ urls, ownerId, listingId, existingUrls = [] }) => {
  const desired = urls || [];
  if (desired.length === 0) return [];
  if (desired.length > env.productImageMaxCount) throw new BadRequest(`A maximum of ${env.productImageMaxCount} images is allowed.`);
  if (new Set(desired).size !== desired.length) throw new BadRequest('The same image cannot be attached more than once.');
  const records = await ProductImage.find({ secureUrl: { $in: desired } });
  const byUrl = new Map(records.map((record) => [record.secureUrl, record]));
  const existingSet = new Set(existingUrls);
  const pendingIds = [];
  for (const url of desired) {
    const record = byUrl.get(url);
    if (!record) {
      if (usesScopedAssets() || !existingSet.has(url)) throw new BadRequest('One or more image references are not approved uploads.');
      continue;
    }
    if (record.owner.toString() !== ownerId) throw new Forbidden('An image belongs to another user.');
    if (!canModifyImage(record)) throw new Forbidden('Image cannot be modified in this environment.');
    if (record.status === 'pending' && record.expiresAt && record.expiresAt <= new Date()) throw new BadRequest('An image upload has expired.');
    if (record.status === 'attached' && record.listing?.toString() !== listingId.toString()) throw new BadRequest('An image is already attached to another listing.');
    if (record.status === 'cleanup_pending') throw new BadRequest('An image is pending removal.');
    if (record.status === 'pending') pendingIds.push(record._id);
  }
  if (pendingIds.length) {
    const result = await ProductImage.updateMany(
      { _id: { $in: pendingIds }, owner: ownerId, status: 'pending', listing: null },
      { $set: { status: 'attached', listing: listingId, expiresAt: new Date('9999-12-31T23:59:59.999Z') } }
    );
    if (result.modifiedCount !== pendingIds.length) throw new BadRequest('One or more images changed while the listing was being saved. Please retry.');
  }
  return pendingIds;
};

export const releaseReservedImages = (ids, ownerId, listingId) => ids.length ? ProductImage.updateMany(
  { _id: { $in: ids }, owner: ownerId, listing: listingId, status: 'attached' },
  { $set: { status: 'pending', listing: null, expiresAt: new Date(Date.now() + env.productImagePendingTtlMs) } }
) : Promise.resolve();

export const markRemovedImagesForCleanup = async ({ removedUrls, ownerId, listingId }) => {
  if (!removedUrls?.length) return [];
  const records = await ProductImage.find({ secureUrl: { $in: removedUrls }, owner: ownerId, listing: listingId, status: 'attached' });
  const ids = records.filter(canModifyImage).map((record) => record._id);
  if (ids.length) await ProductImage.updateMany({ _id: { $in: ids } }, { $set: { status: 'cleanup_pending', expiresAt: new Date() } });
  return ids;
};

export const cleanupProductImages = async (filter, limit = 20) => {
  if (!isCloudinaryConfigured()) return { cleaned: 0, failed: 0 };
  configureCloudinary();
  const images = await ProductImage.find(filter).sort({ expiresAt: 1 }).limit(limit);
  let cleaned = 0; let failed = 0;
  for (const image of images) {
    if (!canModifyImage(image)) { failed += 1; continue; }
    try {
      const result = await cloudinary.uploader.destroy(image.publicId, { resource_type: 'image', type: 'upload', invalidate: true });
      if (!['ok', 'not found'].includes(result?.result)) throw new Error('provider_rejected_cleanup');
      await ProductImage.deleteOne({ _id: image._id }); cleaned += 1;
    } catch (error) {
      failed += 1;
      await ProductImage.updateOne({ _id: image._id }, { $inc: { cleanupAttempts: 1 }, $set: { status: 'cleanup_pending', lastCleanupError: String(error?.name || 'cleanup_failed').slice(0, 120), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    }
  }
  return { cleaned, failed };
};

export const reconcileDetachedProductImages = async () => {
  const records = await ProductImage.find({ status: 'attached' }).sort({ updatedAt: 1 }).limit(100).populate('listing', 'images');
  const detachedIds = records.filter((record) => canModifyImage(record) && (!record.listing || !record.listing.images?.includes(record.secureUrl))).map((record) => record._id);
  if (detachedIds.length) await ProductImage.updateMany({ _id: { $in: detachedIds }, status: 'attached' }, { $set: { status: 'cleanup_pending', expiresAt: new Date() } });
  return detachedIds.length;
};

export const cleanupExpiredProductImages = async () => {
  await reconcileDetachedProductImages();
  return cleanupProductImages({
    $or: [{ status: 'cleanup_pending', expiresAt: { $lte: new Date() } }, { status: 'pending', expiresAt: { $lte: new Date() } }]
  });
};

export const deleteOwnedPendingImage = async (imageId, ownerId) => {
  const image = await ProductImage.findOne({ _id: imageId, owner: ownerId, status: 'pending', listing: null });
  if (!image || !canModifyImage(image)) throw new Forbidden('Image cannot be removed.');
  image.status = 'cleanup_pending'; image.expiresAt = new Date(); await image.save();
  return cleanupProductImages({ _id: image._id }, 1);
};
