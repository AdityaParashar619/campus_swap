import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden } from '../utils/AppError.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { getChatAccess } from '../utils/connections.js';
import { buildConversationSummaryPipeline, parseSummaryPagination } from '../utils/messageSummaries.js';
import { createNotification } from '../services/notificationService.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

export const normalizeMessageInput = ({ receiverId, text } = {}) => {
  if (typeof receiverId !== 'string' || !mongoose.isValidObjectId(receiverId)) throw new BadRequest('A valid receiver is required.');
  if (typeof text !== 'string' || !text.trim()) throw new BadRequest('Message text is required.');
  const normalizedText = text.trim();
  if (normalizedText.length > 2000) throw new BadRequest('Message text must be 2000 characters or fewer.');
  return { receiverId, text: normalizedText };
};

export const getConversationSummaries = asyncHandler(async (req, res) => {
  const pagination = parseSummaryPagination(req.query);
  const [result = { data: [], metadata: [] }] = await Message.aggregate(
    buildConversationSummaryPipeline(req.user.userId, pagination)
  );
  const total = result.metadata[0]?.total || 0;
  res.json({
    success: true,
    data: result.data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit)
    }
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, text } = normalizeMessageInput(req.body);
  if (receiverId === req.user.userId) throw new BadRequest('You cannot message yourself.');

  const receiverExists = await User.exists({
    _id: receiverId,
    isBlocked: { $ne: true },
    accountStatus: { $nin: ['pending', 'suspended', 'blocked'] }
  });
  if (!receiverExists) throw new BadRequest('Receiver is unavailable.');

  const access = await getChatAccess(req.user.userId, receiverId);
  if (!access.canSend) {
    throw new Forbidden('Connect with this student to continue the conversation.');
  }

  const message = await Message.create({ sender: req.user.userId, receiver: receiverId, text });
  await message.populate('sender receiver', 'name profilePicture');

  const io = req.app.locals.io;
  if (io) io.to(`user:${receiverId}`).emit('receiveMessage', message);

  await createNotification(io, {
    user: receiverId,
    type: 'message',
    title: 'New message',
    body: `${message.sender?.name || 'A student'} sent you a message.`,
    metadata: { senderId: req.user.userId, action: 'reply_chat' }
  });

  const updatedAccess = await getChatAccess(req.user.userId, receiverId);
  res.status(201).json({ success: true, message: 'Message sent', data: message, chatAccess: updatedAccess });
});

export const getMessages = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.userId;
  if (!mongoose.isValidObjectId(userId) || userId === currentUserId) throw new BadRequest('A valid conversation user is required.');
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const skip = (page - 1) * limit;

  const [messages, total, access] = await Promise.all([
    Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    })
      .populate('sender receiver', 'name profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    }),
    getChatAccess(currentUserId, userId)
  ]);

  res.json({ success: true, data: messages.reverse(), chatAccess: access, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});
