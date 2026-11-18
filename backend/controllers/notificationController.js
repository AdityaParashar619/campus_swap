import { asyncHandler } from '../middleware/errorMiddleware.js';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { BadRequest } from '../utils/AppError.js';

const parsePagination = (query = {}) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) throw new BadRequest('page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequest('limit must be an integer between 1 and 50');
  return { page, limit, skip: (page - 1) * limit };
};

export const getNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user.userId };
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .select('type title body metadata isRead createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter)
  ]);
  res.json({
    success: true,
    data: notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({ user: req.user.userId, isRead: { $ne: true } });
  res.json({ unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new BadRequest('Invalid notification ID');
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.userId },
    { $set: { isRead: true } },
    { new: true }
  ).select('type title body metadata isRead createdAt');

  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }

  res.json({ success: true, message: 'Notification updated', data: notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user.userId, isRead: { $ne: true } },
    { $set: { isRead: true } }
  );
  res.json({ success: true, message: 'Notifications updated', modifiedCount: result.modifiedCount || 0 });
});

export { parsePagination };
