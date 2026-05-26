import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest } from '../utils/AppError.js';
import Connection from '../models/Connection.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const sendConnectionRequest = asyncHandler(async (req, res) => {
  const recipientId = req.body.recipientId;

  if (!recipientId) throw new BadRequest('recipientId is required');
  if (recipientId === req.user.userId) throw new BadRequest('Cannot connect with yourself');

  const existing = await Connection.findOne({
    $or: [
      { requester: req.user.userId, recipient: recipientId },
      { requester: recipientId, recipient: req.user.userId }
    ]
  });
  if (existing?.status === 'accepted') {
    return res.json({ success: true, message: 'You are already connected', data: existing });
  }

  if (existing?.status === 'pending') {
    return res.json({ success: true, message: 'Connection request already pending', data: existing });
  }

  if (existing?.status === 'rejected') {
    existing.requester = req.user.userId;
    existing.recipient = recipientId;
    existing.status = 'pending';
    await existing.save();

    await Notification.create({
      user: recipientId,
      type: 'connection',
      title: 'New connection request',
      body: 'A student sent you a connection request.',
      metadata: { connectionId: existing._id, requesterId: req.user.userId, action: 'open_network' }
    });

    return res.json({ success: true, message: 'Connection request sent again', data: existing });
  }

  const connection = await Connection.create({ requester: req.user.userId, recipient: recipientId });

  await Notification.create({
    user: recipientId,
    type: 'connection',
    title: 'New connection request',
    body: 'A student sent you a connection request.',
    metadata: { connectionId: connection._id, requesterId: req.user.userId, action: 'open_network' }
  });

  res.status(201).json({ success: true, message: 'Connection request sent', data: connection });
});

export const respondToConnectionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['accepted', 'rejected'].includes(status)) {
    throw new BadRequest('status must be accepted or rejected');
  }

  const connection = await Connection.findOneAndUpdate(
    { _id: id, recipient: req.user.userId, status: 'pending' },
    { status },
    { new: true }
  );

  if (!connection) {
    throw new BadRequest('Connection request not found or already handled');
  }

  await Notification.create({
    user: connection.requester,
    type: 'connection',
    title: 'Connection request update',
    body: `Your connection request was ${status}.`,
    metadata: { connectionId: connection._id, status, action: 'open_network' }
  });

  res.json({ success: true, message: `Connection request ${status}`, data: connection });
});

export const getMyConnections = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const connections = await Connection.find({
    $or: [{ requester: userId }, { recipient: userId }]
  })
    .populate('requester', 'name profilePicture course yearSemester trustScore')
    .populate('recipient', 'name profilePicture course yearSemester trustScore')
    .sort({ updatedAt: -1 });

  res.json({ success: true, data: connections });
});

export const getConnectionSuggestions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const [users, connections] = await Promise.all([
    User.find({ _id: { $ne: userId }, isBlocked: { $ne: true } })
      .select('name email _id course yearSemester trustScore isVerifiedStudent profilePicture collegeName bio interests skills')
      .sort({ trustScore: -1, createdAt: -1 })
      .limit(50),
    Connection.find({ $or: [{ requester: userId }, { recipient: userId }] })
  ]);

  const connectionByUserId = new Map();
  connections.forEach((connection) => {
    const otherUserId =
      connection.requester.toString() === userId ? connection.recipient.toString() : connection.requester.toString();
    connectionByUserId.set(otherUserId, connection);
  });

  const data = users.map((user) => {
    const connection = connectionByUserId.get(user._id.toString());
    return {
      ...user.toObject(),
      connection: connection
        ? {
            id: connection._id,
            status: connection.status,
            direction: connection.requester.toString() === userId ? 'outgoing' : 'incoming'
          }
        : null
    };
  });

  res.json({ success: true, data });
});
