import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest } from '../utils/AppError.js';
import Bounty from '../models/Bounty.js';
import { serializePublicProfile } from '../utils/connections.js';

export const createBounty = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    throw new BadRequest('Title required');
  }

  const bounty = await Bounty.create({ title, description, user: req.user.userId });
  res.status(201).json({ success: true, message: 'Bounty created', bounty });
});

export const getBounties = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Bounty.find().populate('user', 'name email contactVisibility phoneNumber whatsappNumber').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Bounty.countDocuments()
  ]);

  const publicItems = items.map((item) => {
    const data = item.toObject();
    if (data.user) data.user = serializePublicProfile(data.user);
    return data;
  });

  res.json({
    success: true,
    data: publicItems,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});
