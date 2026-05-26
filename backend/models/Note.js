import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileType: { type: String, enum: ['pdf', 'image', 'doc', 'other'], default: 'pdf' },
    branch: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }],
    bookmarksCount: { type: Number, default: 0, min: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

noteSchema.index({ branch: 1, semester: 1, subject: 1 });
noteSchema.index({ title: 'text', description: 'text', subject: 'text' });

export default mongoose.model('Note', noteSchema);
