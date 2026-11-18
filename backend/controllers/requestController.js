import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden, NotFound } from '../utils/AppError.js';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import RequestPost from '../models/RequestPost.js';
import { createNotification } from '../services/notificationService.js';

const CREATE_FIELDS = new Set(['title', 'description', 'category', 'neededBy', 'location']);
const REQUEST_CATEGORIES = new Map(['General', 'Borrow', 'Notes', 'Help', 'Other'].map((value) => [value.toLowerCase(), value]));

const requireValidId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new BadRequest('Invalid request ID');
};

const normalizeCreation = (body = {}) => {
  const unsupported = Object.keys(body).filter((field) => !CREATE_FIELDS.has(field));
  if (unsupported.length) throw new BadRequest(`Unsupported request field: ${unsupported[0]}`);
  if (typeof body.title !== 'string' || !body.title.trim()) throw new BadRequest('title is required');
  if (body.title.trim().length > 120) throw new BadRequest('title must be 120 characters or fewer');
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.trim().length > 1000)) throw new BadRequest('description must be text with at most 1000 characters');
  if (body.location !== undefined && (typeof body.location !== 'string' || body.location.trim().length > 120)) throw new BadRequest('location must be text with at most 120 characters');
  if (body.category !== undefined && typeof body.category !== 'string') throw new BadRequest('category must be text');
  const category = REQUEST_CATEGORIES.get((body.category || 'General').trim().toLowerCase());
  if (!category) throw new BadRequest('category must be General, Borrow, Notes, Help, or Other');
  let neededBy = null;
  if (body.neededBy) {
    neededBy = new Date(body.neededBy);
    if (Number.isNaN(neededBy.getTime())) throw new BadRequest('neededBy must be a valid date');
  }
  return { title: body.title.trim(), description: body.description?.trim() || '', category, neededBy, location: body.location?.trim() || '' };
};

export const createRequestPost = asyncHandler(async (req, res) => {
  const data = await RequestPost.create({ ...normalizeCreation(req.body), user: req.user.userId });
  res.status(201).json({ success: true, message: 'Request post created', data });
});

export const getRequestPosts = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const filter = { status: 'open' };
  const [data, total] = await Promise.all([
    RequestPost.find(filter)
      .populate('user', 'name profilePicture trustScore')
      .populate('fulfilledBy', 'name profilePicture trustScore')
      .populate('responses.user', 'name profilePicture trustScore')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    RequestPost.countDocuments(filter)
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const respondToRequestPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  requireValidId(id);
  if (typeof message !== 'string' || !message.trim()) throw new BadRequest('Response message is required');
  if (message.trim().length > 500) throw new BadRequest('Response message must be 500 characters or fewer');

  const post = await RequestPost.findById(id);
  if (!post) throw new NotFound('Request post not found');
  if (post.status !== 'open') throw new BadRequest('This request is no longer open');
  if (post.user.toString() === req.user.userId) throw new BadRequest('You cannot respond to your own request');

  const existingResponse = post.responses.find((response) => response.user.toString() === req.user.userId);
  if (existingResponse) {
    existingResponse.message = message.trim();
    existingResponse.status = 'offered';
    existingResponse.createdAt = new Date();
  } else {
    post.responses.push({ user: req.user.userId, message: message.trim() });
  }

  await post.save();

  await createNotification(req.app?.locals?.io, {
    user: post.user,
    type: 'request',
    title: 'New request response',
    body: 'A student responded to your borrow request.',
    metadata: { requestId: post._id, responderId: req.user.userId }
  });

  const populatedPost = await RequestPost.findById(id)
    .populate('user', 'name profilePicture trustScore')
    .populate('fulfilledBy', 'name profilePicture trustScore')
    .populate('responses.user', 'name profilePicture trustScore');

  res.status(201).json({ success: true, message: 'Response sent', data: populatedPost });
});

export const updateRequestPostStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, fulfilledBy } = req.body;
  requireValidId(id);
  if (!['fulfilled', 'closed'].includes(status)) throw new BadRequest('status must be fulfilled or closed');

  if (status === 'closed') {
    const closed = await RequestPost.findOneAndUpdate(
      { _id: id, user: req.user.userId, status: 'open' },
      { $set: { status: 'closed', fulfilledBy: null } },
      { new: true, runValidators: true }
    );
    if (!closed) {
      const existing = await RequestPost.findById(id);
      if (!existing) throw new NotFound('Request post not found');
      if (existing.user.toString() !== req.user.userId) throw new Forbidden('Not authorized');
      if (existing.status !== 'closed') throw new BadRequest('Only open requests can be closed');
    }
    const populatedClosed = await RequestPost.findById(id)
      .populate('user', 'name profilePicture trustScore')
      .populate('fulfilledBy', 'name profilePicture trustScore')
      .populate('responses.user', 'name profilePicture trustScore');
    return res.json({ success: true, message: 'Request closed', data: populatedClosed });
  }

  if (!mongoose.isValidObjectId(fulfilledBy)) throw new BadRequest('A valid responder is required to fulfill a request');

  const post = await RequestPost.findById(id);
  if (!post) throw new NotFound('Request post not found');
  if (post.user.toString() !== req.user.userId) throw new Forbidden('Not authorized');
  if (post.status !== 'open') throw new BadRequest('Only open requests can be fulfilled');
  if (!post.responses.some((response) => response.user.toString() === fulfilledBy)) throw new BadRequest('The selected student has not responded to this request');

  post.status = 'fulfilled';
  post.fulfilledBy = fulfilledBy;

  if (fulfilledBy) {
    post.responses.forEach((response) => {
      response.status = response.user.toString() === fulfilledBy ? 'accepted' : 'declined';
    });

    await createNotification(req.app?.locals?.io, {
      user: fulfilledBy,
      type: 'request',
      title: 'Borrow request fulfilled',
      body: 'Your response was accepted by the request owner.',
      metadata: { requestId: post._id }
    });
  }

  await post.save();

  const populatedPost = await RequestPost.findById(id)
    .populate('user', 'name profilePicture trustScore')
    .populate('fulfilledBy', 'name profilePicture trustScore')
    .populate('responses.user', 'name profilePicture trustScore');

  res.json({ success: true, message: 'Request status updated', data: populatedPost });
});
