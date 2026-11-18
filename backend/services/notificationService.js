import Notification from '../models/Notification.js';

const toNotificationPayload = (notification) => {
  const value = notification?.toObject ? notification.toObject() : notification;
  if (!value) return null;
  return {
    _id: value._id,
    type: value.type,
    title: value.title,
    body: value.body,
    metadata: value.metadata || {},
    isRead: Boolean(value.isRead),
    createdAt: value.createdAt
  };
};

export const createNotification = async (io, data) => {
  const notification = await Notification.create(data);
  const payload = toNotificationPayload(notification);
  if (io && payload) io.to(`user:${String(data.user)}`).emit('notification:new', payload);
  return notification;
};

export { toNotificationPayload };
