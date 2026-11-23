import mongoose from 'mongoose';

export const ISSUE_CATEGORIES = Object.freeze([
  'infrastructure', 'cleanliness', 'water', 'electricity', 'internet', 'library', 'hostel', 'accessibility', 'other'
]);
export const ISSUE_STATUSES = Object.freeze(['submitted', 'under_review', 'resolved', 'closed']);
export const ISSUE_LIMITS = Object.freeze({
  title: 120, description: 3000, locationDescription: 300, adminResponse: 2000, resolutionNote: 2000
});
export const ISSUE_NOTE_MIN_LENGTH = 10;

const attachment = new mongoose.Schema({
  evidenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  storageKey: { type: mongoose.Schema.Types.ObjectId, required: true },
  mediaType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  sizeBytes: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  uploadedAt: { type: Date, required: true }
}, { _id: false });

const text = (field, required = false) => ({ type: String, trim: true, maxlength: ISSUE_LIMITS[field], required });
const schema = new mongoose.Schema({
  title: text('title', true),
  description: text('description', true),
  category: { type: String, required: true, enum: ISSUE_CATEGORIES },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  status: { type: String, required: true, enum: ISSUE_STATUSES, default: 'submitted' },
  locationDescription: text('locationDescription'),
  campusLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'CampusLocation', default: null },
  attachments: { type: [attachment], default: undefined, select: false, validate: (photos) => photos.length <= 3 },
  evidenceCloud: { type: String, immutable: true, select: false },
  evidenceStage: { type: String, enum: ['uploading', 'abandoned', 'recovering'], select: false },
  submissionKey: { type: String, select: false },
  testFixture: { type: Boolean, immutable: true, select: false },
  cleanupPendingAt: { type: Date, select: false },
  adminResponse: text('adminResponse'),
  resolutionNote: text('resolutionNote'),
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  // Startup and submissions install the declared indexes after the connection opens.
  autoCreate: false,
  autoIndex: false
});

schema.index({ createdBy: 1, createdAt: -1, _id: -1 });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ createdBy: 1, submissionKey: 1 }, {
  unique: true, partialFilterExpression: { submissionKey: { $type: 'string' } }
});

export default mongoose.model('CampusIssue', schema);
