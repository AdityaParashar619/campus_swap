import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['listing', 'user', 'chat', 'note', 'request'], required: true },
    targetId: { type: String, required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'abusive_chat', 'illegal_content', 'scam', 'copyright', 'feedback', 'other'],
      required: true
    },
    explanation: { type: String, default: '', trim: true },
    screenshotUrl: { type: String, default: '' },
    status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' },
    adminNote: { type: String, default: '', trim: true },
    actionTaken: {
      type: String,
      enum: ['none', 'warning', 'user_blocked', 'listing_hidden', 'dismissed'],
      default: 'none'
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Report', reportSchema);
