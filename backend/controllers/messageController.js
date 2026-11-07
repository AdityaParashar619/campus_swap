import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden } from '../utils/AppError.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { getChatAccess } from '../utils/connections.js';

export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, text } = req.body;

  if (!receiverId || !text) {
    throw new BadRequest('Receiver and text required');
  }

  const access = await getChatAccess(req.user.userId, receiverId);
  if (!access.canSend) {
    throw new Forbidden('Connect with this student to continue the conversation.');
  }

  const message = await Message.create({ sender: req.user.userId, receiver: receiverId, text });
  await message.populate('sender receiver', 'name profilePicture');

  const io = req.app.locals.io;
  if (io) io.to(`user:${receiverId}`).emit('receiveMessage', message);

  await Notification.create({
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
