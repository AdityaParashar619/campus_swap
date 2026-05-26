import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, Forbidden, NotFound } from '../utils/AppError.js';
import Notification from '../models/Notification.js';
import RequestPost from '../models/RequestPost.js';

export const createRequestPost = asyncHandler(async (req, res) => {
  const { title, description, category, neededBy, location } = req.body;
  if (!title) throw new BadRequest('title is required');

  const data = await RequestPost.create({ title, description, category, neededBy, location, user: req.user.userId });
  res.status(201).json({ success: true, message: 'Request post created', data });
});

export const getRequestPosts = asyncHandler(async (_req, res) => {
  const data = await RequestPost.find()
    .populate('user', 'name profilePicture trustScore')
    .populate('fulfilledBy', 'name profilePicture trustScore')
    .populate('responses.user', 'name profilePicture trustScore')
    .sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const respondToRequestPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message?.trim()) throw new BadRequest('Response message is required');

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

  await Notification.create({
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
  if (!['open', 'fulfilled', 'closed'].includes(status)) throw new BadRequest('Invalid status value');

  const post = await RequestPost.findById(id);
  if (!post) throw new NotFound('Request post not found');
  if (post.user.toString() !== req.user.userId) throw new Forbidden('Not authorized');

  post.status = status;
  post.fulfilledBy = status === 'fulfilled' ? fulfilledBy || null : null;

  if (status === 'fulfilled' && fulfilledBy) {
    post.responses.forEach((response) => {
      response.status = response.user.toString() === fulfilledBy ? 'accepted' : 'declined';
    });

    await Notification.create({
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
