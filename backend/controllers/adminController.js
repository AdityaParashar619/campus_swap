import { asyncHandler } from '../middleware/errorMiddleware.js';
import Listing from '../models/Listing.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { BadRequest, NotFound } from '../utils/AppError.js';

export const getAdminOverview = asyncHandler(async (_req, res) => {
  const [users, listings, reportsOpen, reportsTotal] = await Promise.all([
    User.countDocuments(),
    Listing.countDocuments(),
    Report.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
    Report.countDocuments()
  ]);

  res.json({ success: true, data: { users, listings, reportsOpen, reportsTotal } });
});

export const getReportsQueue = asyncHandler(async (_req, res) => {
  const reports = await Report.find()
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email isBlocked')
    .populate('resolvedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(200);

  res.json({ success: true, data: reports });
});

export const updateReportStatus = asyncHandler(async (req, res) => {
  const { status, adminNote = '', actionTaken = 'none' } = req.body;
  if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
    throw new BadRequest('Invalid report status');
  }

  const updates = {
    status,
    adminNote,
    actionTaken,
    resolvedBy: ['resolved', 'dismissed'].includes(status) ? req.user.userId : null,
    resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null
  };

  const report = await Report.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email isBlocked')
    .populate('resolvedBy', 'name email');
  if (!report) throw new NotFound('Report not found');

  res.json({ success: true, message: 'Report status updated', data: report });
});

export const takeReportAction = asyncHandler(async (req, res) => {
  const { action, adminNote = '' } = req.body;
  const report = await Report.findById(req.params.id);
  if (!report) throw new NotFound('Report not found');

  if (action === 'block_user') {
    if (!report.targetUser) throw new BadRequest('Report has no target user to block');
    await User.findByIdAndUpdate(report.targetUser, { isBlocked: true });
    report.actionTaken = 'user_blocked';
    report.status = 'resolved';
  } else if (action === 'hide_listing') {
    if (report.targetType !== 'listing') throw new BadRequest('Report target is not a listing');
    await Listing.findByIdAndUpdate(report.targetId, { isHidden: true });
    report.actionTaken = 'listing_hidden';
    report.status = 'resolved';
  } else if (action === 'warning') {
    report.actionTaken = 'warning';
    report.status = 'resolved';
  } else if (action === 'dismiss') {
    report.actionTaken = 'dismissed';
    report.status = 'dismissed';
  } else {
    throw new BadRequest('Invalid report action');
  }

  report.adminNote = adminNote;
  report.resolvedBy = req.user.userId;
  report.resolvedAt = new Date();
  await report.save();

  const data = await Report.findById(report._id)
    .populate('reporter', 'name email')
    .populate('targetUser', 'name email isBlocked')
    .populate('resolvedBy', 'name email');

  res.json({ success: true, message: 'Report action applied', data });
});

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find().select('name email role trustScore isVerifiedStudent isBlocked createdAt');
  res.json({ success: true, data: users });
});

export const setUserBlockStatus = asyncHandler(async (req, res) => {
  const { isBlocked } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: Boolean(isBlocked) }, { new: true })
    .select('name email isBlocked');

  if (!user) throw new NotFound('User not found');

  res.json({ success: true, message: 'User block status updated', data: user });
});

export const listListings = asyncHandler(async (_req, res) => {
  const listings = await Listing.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: listings });
});

export const setListingHiddenStatus = asyncHandler(async (req, res) => {
  const { isHidden } = req.body;
  const listing = await Listing.findByIdAndUpdate(req.params.id, { isHidden: Boolean(isHidden) }, { new: true });

  if (!listing) throw new NotFound('Listing not found');

  res.json({ success: true, message: 'Listing visibility updated', data: listing });
});
