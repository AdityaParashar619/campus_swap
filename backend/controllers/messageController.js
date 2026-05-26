import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest } from '../utils/AppError.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

export const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, text } = req.body;

  if (!receiverId || !text) {
    throw new BadRequest('Receiver and text required');
  }

  const message = await Message.create({ sender: req.user.userId, receiver: receiverId, text });
  await message.populate('sender receiver', 'name email');

  const io = req.app.locals.io;
  if (io) io.to(`user:${receiverId}`).emit('receiveMessage', message);

  await Notification.create({
    user: receiverId,
    type: 'message',
    title: 'New message',
    body: `${message.sender?.name || 'A student'} sent you a message.`,
    metadata: { senderId: req.user.userId, action: 'reply_chat' }
  });

  res.status(201).json({ success: true, message: 'Message sent', data: message });
});

export const getMessages = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.userId;

  const messages = await Message.find({
    $or: [
      { sender: currentUserId, receiver: userId },
      { sender: userId, receiver: currentUserId }
    ]
  })
    .populate('sender receiver', 'name email')
    .sort({ createdAt: 1 });

  res.json({ success: true, data: messages });
});
