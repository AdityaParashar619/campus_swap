import { asyncHandler } from '../middleware/errorMiddleware.js';
import { BadRequest, NotFound } from '../utils/AppError.js';
import Note from '../models/Note.js';
import User from '../models/User.js';

export const createNote = asyncHandler(async (req, res) => {
  const { title, description, fileUrl, fileType, branch, semester, subject, tags } = req.body;

  if (!title || !fileUrl || !branch || !semester || !subject) {
    throw new BadRequest('title, fileUrl, branch, semester and subject are required');
  }

  const note = await Note.create({
    title,
    description,
    fileUrl,
    fileType,
    branch,
    semester,
    subject,
    tags,
    user: req.user.userId
  });

  res.status(201).json({ success: true, message: 'Note uploaded', data: note });
});

export const getNotes = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.branch) filter.branch = req.query.branch;
  if (req.query.semester) filter.semester = req.query.semester;
  if (req.query.subject) filter.subject = req.query.subject;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [items, total] = await Promise.all([
    Note.find(filter)
      .populate('user', 'name profilePicture trustScore')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Note.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

export const toggleBookmarkNote = asyncHandler(async (req, res) => {
  const noteId = req.params.id;

  const [user, note] = await Promise.all([User.findById(req.user.userId), Note.findById(noteId)]);

  if (!user) throw new NotFound('User not found');
  if (!note) throw new NotFound('Note not found');

  const existingIndex = user.bookmarkedNotes.findIndex((id) => id.toString() === noteId);

  if (existingIndex > -1) {
    user.bookmarkedNotes.splice(existingIndex, 1);
    note.bookmarksCount = Math.max((note.bookmarksCount || 0) - 1, 0);
    await Promise.all([user.save(), note.save()]);
    return res.json({ success: true, message: 'Note removed from bookmarks' });
  }

  user.bookmarkedNotes.push(note._id);
  note.bookmarksCount += 1;
  await Promise.all([user.save(), note.save()]);

  res.json({ success: true, message: 'Note bookmarked' });
});
