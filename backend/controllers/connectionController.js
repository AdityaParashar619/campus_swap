import { asyncHandler } from '../middleware/errorMiddleware.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { BadRequest, NotFound } from '../utils/AppError.js';
import Connection from '../models/Connection.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { exposeContactForConnection } from '../utils/connections.js';
import { createNotification } from '../services/notificationService.js';
import { academicProfile } from '../utils/institution.js';

const publicStudent = (student, connected) => {
  const exposed = exposeContactForConnection(student, connected);
  return { ...exposed, ...academicProfile(exposed) };
};

const relationshipQuery = (userId, otherUserId) => ({
  $or: [
    { requester: userId, recipient: otherUserId },
    { requester: otherUserId, recipient: userId }
  ]
});

const relationshipId = (userId, otherUserId) => {
  const pair = [String(userId), String(otherUserId)].sort().join(':');
  return new mongoose.Types.ObjectId(crypto.createHash('sha256').update(pair).digest('hex').slice(0, 24));
};

const serializeRelationship = (connection, userId) => {
  if (!connection) return null;
  const item = connection.toObject ? connection.toObject() : connection;
  return {
    id: item._id,
    status: item.status,
    direction: String(item.requester?._id || item.requester) === String(userId) ? 'outgoing' : 'incoming'
  };
};

const createConnectionNotification = (io, recipientId, connection, requesterId) => createNotification(io, {
  user: recipientId,
  type: 'connection',
  title: 'New connection request',
  body: 'A student sent you a connection request.',
  metadata: { connectionId: connection._id, requesterId, action: 'open_network' }
});

export const sendConnectionRequest = asyncHandler(async (req, res) => {
  const recipientId = req.body.recipientId;

  if (!recipientId) throw new BadRequest('recipientId is required');
  if (recipientId === req.user.userId) throw new BadRequest('Cannot connect with yourself');
  if (!mongoose.isValidObjectId(recipientId)) throw new BadRequest('Invalid recipientId');

  const recipient = await User.exists({
    _id: recipientId,
    isBlocked: { $ne: true },
    accountStatus: { $nin: ['pending', 'suspended', 'blocked'] }
  });
  if (!recipient) throw new NotFound('Student not found');

  const existing = await Connection.findOne(relationshipQuery(req.user.userId, recipientId));
  if (existing?.status === 'accepted') {
    return res.json({ success: true, message: 'You are already connected', data: existing });
  }

  if (existing?.status === 'pending') {
    return res.json({ success: true, message: 'Connection request already pending', data: existing });
  }

  if (existing?.status === 'rejected') {
    const reopened = await Connection.findOneAndUpdate(
      { _id: existing._id, status: 'rejected' },
      { requester: req.user.userId, recipient: recipientId, status: 'pending' },
      { new: true }
    );
    if (!reopened) {
      const current = await Connection.findOne(relationshipQuery(req.user.userId, recipientId));
      return res.json({ success: true, message: current?.status === 'accepted' ? 'You are already connected' : 'Connection request already pending', data: current });
    }

    await createConnectionNotification(req.app?.locals?.io, recipientId, reopened, req.user.userId);
    return res.json({ success: true, message: 'Connection request sent again', data: reopened });
  }

  let connection;
  try {
    connection = await Connection.create({ _id: relationshipId(req.user.userId, recipientId), requester: req.user.userId, recipient: recipientId });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    connection = await Connection.findOne(relationshipQuery(req.user.userId, recipientId));
    if (!connection) throw error;
    return res.json({ success: true, message: connection.status === 'accepted' ? 'You are already connected' : 'Connection request already pending', data: connection });
  }

  await createConnectionNotification(req.app?.locals?.io, recipientId, connection, req.user.userId);

  res.status(201).json({ success: true, message: 'Connection request sent', data: connection });
});

export const getStudentRelationship = asyncHandler(async (req, res) => {
  const currentUserId = req.user.userId;
  const studentId = req.params.userId;
  if (!mongoose.isValidObjectId(studentId)) throw new BadRequest('Invalid student ID');
  if (studentId === currentUserId) throw new BadRequest('Use your account profile for your own ID');

  const [student, connection] = await Promise.all([
    User.findOne({ _id: studentId, isBlocked: { $ne: true }, accountStatus: { $nin: ['pending', 'suspended', 'blocked'] } })
      .select('name _id branch semester course yearSemester isVerifiedStudent profilePicture bio interests skills phoneNumber whatsappNumber contactVisibility'),
    Connection.findOne(relationshipQuery(currentUserId, studentId))
  ]);
  if (!student) throw new NotFound('Student not found');

  const accepted = connection?.status === 'accepted';
  res.json({
    success: true,
    data: {
      student: publicStudent(student, accepted),
      connection: serializeRelationship(connection, currentUserId)
    }
  });
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

  if (status === 'accepted') {
    await User.updateMany(
      { _id: { $in: [connection.requester, connection.recipient] } },
      [{ $set: { trustScore: { $min: [100, { $add: ['$trustScore', 2] }] } } }]
    );
  }

  await createNotification(req.app?.locals?.io, {
    user: connection.requester,
    type: 'connection',
    title: 'Connection request update',
    body: `Your connection request was ${status}.`,
    metadata: { connectionId: connection._id, studentId: connection.recipient, status, action: 'open_network' }
  });

  res.json({ success: true, message: `Connection request ${status}`, data: connection });
});

export const getMyConnections = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const connections = await Connection.find({
    $or: [{ requester: userId }, { recipient: userId }]
  })
    .populate('requester', 'name profilePicture branch semester course yearSemester trustScore phoneNumber whatsappNumber contactVisibility')
    .populate('recipient', 'name profilePicture branch semester course yearSemester trustScore phoneNumber whatsappNumber contactVisibility')
    .sort({ updatedAt: -1 });

  const data = connections.map((connection) => {
    const item = connection.toObject();
    const accepted = item.status === 'accepted';
    item.requester = publicStudent(item.requester, accepted);
    item.recipient = publicStudent(item.recipient, accepted);
    return item;
  });

  res.json({ success: true, data });
});

export const getConnectionSuggestions = asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const [users, connections] = await Promise.all([
    User.find({ _id: { $ne: userId }, isBlocked: { $ne: true } })
      .select('name _id branch semester course yearSemester trustScore isVerifiedStudent profilePicture bio interests skills phoneNumber whatsappNumber contactVisibility')
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
    const isAccepted = connection?.status === 'accepted';
    return {
      ...publicStudent(user, isAccepted),
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
