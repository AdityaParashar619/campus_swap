import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest } from '../utils/AppError.js';
import Report from '../models/Report.js';

export const createReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, targetUserId, reason, explanation, screenshotUrl } = req.body;
  if (!targetType || !targetId || !reason) {
    throw new BadRequest('targetType, targetId, and reason are required');
  }

  const data = await Report.create({
    reporter: req.user.userId,
    targetType,
    targetId,
    targetUser: targetUserId || null,
    reason,
    explanation,
    screenshotUrl
  });

  res.status(201).json({ success: true, message: 'Report submitted', data });
});

export const getMyReports = asyncHandler(async (req, res) => {
  const data = await Report.find({ reporter: req.user.userId }).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const getOpenReports = asyncHandler(async (_req, res) => {
  const data = await Report.find({ status: { $in: ['open', 'reviewing'] } })
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email isBlocked')
    .sort({ createdAt: -1 });
  res.json({ success: true, data });
});
