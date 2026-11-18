import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, NotFound } from '../utils/AppError.js';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import { serializePublicProfile } from '../utils/connections.js';
import { assertAvailabilityTransition, validateListingPayload } from '../utils/listingValidation.js';
import { parseListingDiscoveryQuery } from '../utils/listingDiscovery.js';
import {
  cleanupProductImages,
  markRemovedImagesForCleanup,
  releaseReservedImages,
  reserveListingImages
} from '../services/productImageService.js';

const serializeListingSeller = (seller) => {
  if (!seller) return null;
  const data = seller.toObject ? seller.toObject() : { ...seller };
  return {
    _id: data._id,
    name: data.name || 'Campus user',
    profilePicture: data.profilePicture || '',
    verifiedInstitutionalAccount: Boolean(data.emailVerified && data.verificationStatus === 'verified')
  };
};

const serializeListing = (listing) => {
  const data = listing.toObject ? listing.toObject() : { ...listing };
  data.user = serializeListingSeller(data.user);
  return data;
};

export const createListing = asyncHandler(async (req, res) => {
  const values = validateListingPayload(req.body);

  const listing = new Listing({
    ...values,
    availability: 'available',
    user: req.user.userId
  });
  const reservedIds = await reserveListingImages({ urls: values.images || [], ownerId: req.user.userId, listingId: listing._id });
  try { await listing.save(); }
  catch (error) { await releaseReservedImages(reservedIds, req.user.userId, listing._id); throw error; }

  res.status(201).json({ success: true, message: 'Listing created', listing });
});

export const getListings = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = parseListingDiscoveryQuery(req.query);

  const [items, total] = await Promise.all([
    Listing.find(filter)
      .populate('user', 'name email profilePicture trustScore contactVisibility phoneNumber whatsappNumber')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Listing.countDocuments(filter)
  ]);

  const publicItems = items.map((item) => {
    const data = item;
    if (data.user) data.user = serializePublicProfile(data.user);
    return data;
  });

  res.json({
    success: true,
    data: publicItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1
    }
  });
});

export const getListingById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequest('Invalid listing ID.');
  const listing = await Listing.findOne({ _id: req.params.id, isHidden: { $ne: true } })
    .populate('user', 'name profilePicture emailVerified verificationStatus');
  if (!listing || !listing.user) throw new NotFound('Listing not found');
  res.json({ success: true, data: serializeListing(listing) });
});

export const getMyListings = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = parseListingDiscoveryQuery(req.query);
  filter.user = req.user.userId;
  const [items, total] = await Promise.all([
    Listing.find(filter)
      .populate('user', 'name profilePicture emailVerified verificationStatus')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Listing.countDocuments(filter)
  ]);
  res.json({
    success: true,
    data: items.map(serializeListing),
    pagination: {
      page, limit, total, totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1
    }
  });
});

export const updateListing = asyncHandler(async (req, res) => {
  const updates = validateListingPayload(req.body, { partial: true });
  const existing = await Listing.findOne({ _id: req.params.id, user: req.user.userId });
  if (!existing) throw new NotFound('Listing not found');
  assertAvailabilityTransition(existing.availability, updates.availability);
  const reservedIds = updates.images ? await reserveListingImages({ urls: updates.images, ownerId: req.user.userId, listingId: existing._id, existingUrls: existing.images }) : [];
  let listing;
  try {
    listing = await Listing.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId, availability: existing.availability, ...(updates.images ? { images: existing.images } : {}) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!listing) throw new BadRequest('Listing changed while it was being updated. Please retry.');
  } catch (error) {
    await releaseReservedImages(reservedIds, req.user.userId, existing._id);
    throw error;
  }
  if (updates.images) {
    const retained = new Set(updates.images);
    try {
      const removedIds = await markRemovedImagesForCleanup({ removedUrls: existing.images.filter((url) => !retained.has(url)), ownerId: req.user.userId, listingId: existing._id });
      if (removedIds.length) await cleanupProductImages({ _id: { $in: removedIds } }, removedIds.length);
    } catch { console.error('Product image cleanup will be retried after listing update.'); }
  }

  res.json({ success: true, message: 'Listing updated', data: listing });
});

const validateListingId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new BadRequest('Invalid listing ID.');
};

const addFavorite = async (userId, listingId) => {
  validateListingId(listingId);
  const listing = await Listing.findOne({ _id: listingId, isHidden: { $ne: true } }).select('_id');
  if (!listing) throw new NotFound('Listing not found');
  const membership = await User.updateOne(
    { _id: userId, savedListings: { $ne: listing._id } },
    { $addToSet: { savedListings: listing._id } }
  );
  if (membership.modifiedCount) await Listing.updateOne({ _id: listing._id }, { $inc: { favoritesCount: 1 } });
  return { isFavorite: true, changed: Boolean(membership.modifiedCount) };
};

const removeFavorite = async (userId, listingId) => {
  validateListingId(listingId);
  const membership = await User.updateOne(
    { _id: userId, savedListings: listingId },
    { $pull: { savedListings: listingId } }
  );
  if (membership.modifiedCount) {
    await Listing.updateOne(
      { _id: listingId },
      [{ $set: { favoritesCount: { $max: [0, { $subtract: [{ $ifNull: ['$favoritesCount', 0] }, 1] }] } } }]
    );
  }
  return { isFavorite: false, changed: Boolean(membership.modifiedCount) };
};

export const addFavoriteListing = asyncHandler(async (req, res) => {
  const result = await addFavorite(req.user.userId, req.params.id);
  res.json({ success: true, message: result.changed ? 'Added to favorites' : 'Listing already saved', data: result });
});

export const removeFavoriteListing = asyncHandler(async (req, res) => {
  const result = await removeFavorite(req.user.userId, req.params.id);
  res.json({ success: true, message: result.changed ? 'Removed from favorites' : 'Listing was not saved', data: result });
});

export const toggleFavoriteListing = asyncHandler(async (req, res) => {
  validateListingId(req.params.id);
  const isFavorite = Boolean(await User.exists({ _id: req.user.userId, savedListings: req.params.id }));
  const result = isFavorite
    ? await removeFavorite(req.user.userId, req.params.id)
    : await addFavorite(req.user.userId, req.params.id);
  res.json({ success: true, message: result.isFavorite ? 'Added to favorites' : 'Removed from favorites', data: result });
});

export const getFavoriteStatuses = asyncHandler(async (req, res) => {
  const ids = req.body?.listingIds;
  if (!Array.isArray(ids) || ids.length > 50 || ids.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
    throw new BadRequest('listingIds must contain at most 50 valid listing IDs.');
  }
  const user = await User.findById(req.user.userId).select('savedListings');
  if (!user) throw new NotFound('User not found');
  const saved = new Set(user.savedListings.map(String));
  res.json({ success: true, data: Object.fromEntries(ids.map((id) => [id, saved.has(id)])) });
});

export const getSavedListings = asyncHandler(async (req, res) => {
  const { filter, page, limit, skip, sort } = parseListingDiscoveryQuery(req.query);
  const user = await User.findById(req.user.userId).select('savedListings');
  if (!user) throw new NotFound('User not found');
  filter._id = { $in: user.savedListings };
  const [items, total] = await Promise.all([
    Listing.find(filter).populate('user', 'name profilePicture emailVerified verificationStatus').sort(sort).skip(skip).limit(limit).lean(),
    Listing.countDocuments(filter)
  ]);
  res.json({
    success: true,
    data: items.map(serializeListing),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 }
  });
});

export const reconcileFavoriteCount = async (listingId) => {
  validateListingId(String(listingId));
  const favoritesCount = await User.countDocuments({ savedListings: listingId });
  await Listing.updateOne({ _id: listingId }, { $set: { favoritesCount } });
  return favoritesCount;
};

export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
  if (!listing) throw new NotFound('Listing not found');
  await User.updateMany({ savedListings: listing._id }, { $pull: { savedListings: listing._id } });
  try {
    const imageIds = await markRemovedImagesForCleanup({ removedUrls: listing.images, ownerId: req.user.userId, listingId: listing._id });
    if (imageIds.length) await cleanupProductImages({ _id: { $in: imageIds } }, imageIds.length);
  } catch { console.error('Product image cleanup will be retried after listing deletion.'); }
  res.json({ success: true, message: 'Listing deleted' });
});
