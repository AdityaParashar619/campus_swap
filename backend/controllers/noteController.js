import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, NotFound } from '../utils/AppError.js';
import Note from '../models/Note.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { isSafeNoteFileUrl, normalizeNoteInput } from '../utils/noteValidation.js';

export const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({
    ...normalizeNoteInput(req.body),
    user: req.user.userId
  });

  res.status(201).json({ success: true, message: 'Note uploaded', data: note });
});

export const getNotes = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const skip = (page - 1) * limit;

  const boundedQuery = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const filter = {};
  if (req.query.branch) filter.branch = boundedQuery(req.query.branch, 40);
  if (req.query.semester) filter.semester = boundedQuery(req.query.semester, 2);
  if (req.query.subject) filter.subject = boundedQuery(req.query.subject, 120);
  if (req.query.search) filter.$text = { $search: boundedQuery(req.query.search, 120) };

  const [items, total, user] = await Promise.all([
    Note.find(filter)
      .populate('user', 'name profilePicture trustScore')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Note.countDocuments(filter),
    User.findById(req.user.userId).select('bookmarkedNotes').lean()
  ]);

  const bookmarks = new Set((user?.bookmarkedNotes || []).map(String));
  const data = items.map((item) => {
    const serialized = item.toObject();
    const safeFile = isSafeNoteFileUrl(serialized.fileUrl);
    return { ...serialized, fileUrl: safeFile ? serialized.fileUrl : null, isFileAvailable: safeFile, isBookmarked: bookmarks.has(String(item._id)) };
  });

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

export const toggleBookmarkNote = asyncHandler(async (req, res) => {
  const noteId = req.params.id;
  if (!mongoose.isValidObjectId(noteId)) throw new BadRequest('Invalid note ID');
  if (!(await Note.exists({ _id: noteId }))) throw new NotFound('Note not found');

  const userId = req.user.userId;
  const alreadyBookmarked = await User.exists({ _id: userId, bookmarkedNotes: noteId });
  const userUpdate = alreadyBookmarked
    ? await User.updateOne({ _id: userId, bookmarkedNotes: noteId }, { $pull: { bookmarkedNotes: noteId } })
    : await User.updateOne({ _id: userId, bookmarkedNotes: { $ne: noteId } }, { $addToSet: { bookmarkedNotes: noteId } });
  if (!userUpdate.matchedCount) throw new NotFound('User not found');

  if (userUpdate.modifiedCount) {
    await Note.updateOne(
      { _id: noteId },
      alreadyBookmarked
        ? [{ $set: { bookmarksCount: { $max: [{ $subtract: [{ $ifNull: ['$bookmarksCount', 0] }, 1] }, 0] } } }]
        : { $inc: { bookmarksCount: 1 } }
    );
  }

  res.json({ success: true, bookmarked: !alreadyBookmarked, message: alreadyBookmarked ? 'Note removed from bookmarks' : 'Note bookmarked' });
});
