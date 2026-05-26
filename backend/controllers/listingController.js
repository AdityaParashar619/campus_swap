import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden, NotFound } from '../utils/AppError.js';
import Listing from '../models/Listing.js';
import User from '../models/User.js';

export const createListing = asyncHandler(async (req, res) => {
  const { title, description, category, condition, images, availability, tags, price, isSwapAllowed, location } = req.body;

  if (!title) throw new BadRequest('Title required');
  const normalizedCondition = condition === 'used' ? 'good' : condition;

  const listing = await Listing.create({
    title,
    description,
    category,
    condition: normalizedCondition,
    images,
    availability,
    tags,
    price,
    isSwapAllowed,
    location,
    user: req.user.userId
  });

  res.status(201).json({ success: true, message: 'Listing created', listing });
});

export const getListings = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const skip = (page - 1) * limit;

  const filter = { isHidden: { $ne: true } };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.availability) filter.availability = req.query.availability;
  if (req.query.condition) filter.condition = req.query.condition;

  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const [items, total] = await Promise.all([
    Listing.find(filter)
      .populate('user', 'name email profilePicture trustScore')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Listing.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

export const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new NotFound('Listing not found');
  if (listing.user.toString() !== req.user.userId) throw new Forbidden('Not authorized');

  const updates = { ...req.body };
  if (updates.condition === 'used') updates.condition = 'good';

  Object.assign(listing, updates);
  await listing.save();

  res.json({ success: true, message: 'Listing updated', data: listing });
});

export const toggleFavoriteListing = asyncHandler(async (req, res) => {
  const listingId = req.params.id;
  const user = await User.findById(req.user.userId);
  if (!user) throw new NotFound('User not found');

  const listing = await Listing.findById(listingId);
  if (!listing) throw new NotFound('Listing not found');

  const existingIndex = user.savedListings.findIndex((id) => id.toString() === listingId);
  if (existingIndex > -1) {
    user.savedListings.splice(existingIndex, 1);
    listing.favoritesCount = Math.max((listing.favoritesCount || 0) - 1, 0);
    await Promise.all([user.save(), listing.save()]);
    return res.json({ success: true, message: 'Removed from favorites' });
  }

  user.savedListings.push(listing._id);
  listing.favoritesCount += 1;
  await Promise.all([user.save(), listing.save()]);
  res.json({ success: true, message: 'Added to favorites' });
});

export const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw new NotFound('Listing not found');
  if (listing.user.toString() !== req.user.userId) throw new Forbidden('Not authorized');

  await listing.deleteOne();
  res.json({ success: true, message: 'Listing deleted' });
});
