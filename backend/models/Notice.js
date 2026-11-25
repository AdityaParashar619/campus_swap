import mongoose from 'mongoose';
import { academicPrograms } from '../config/academicProgramData.js';

export const NOTICE_CATEGORIES = Object.freeze(['academic', 'examination', 'placement', 'event', 'general']);
export const NOTICE_PRIORITIES = Object.freeze(['normal', 'important', 'urgent']);
export const NOTICE_STATUSES = Object.freeze(['draft', 'published', 'archived']);
export const NOTICE_TARGET_SCOPES = Object.freeze(['college', 'program', 'semester']);
const programCodes = academicPrograms.map(({ programCode }) => programCode);
const safeHttps = (value) => {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

const attachmentSchema = new mongoose.Schema({
  originalName: { type: String, required: true, trim: true, maxlength: 180 },
  displayName: { type: String, required: true, trim: true, maxlength: 180 },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'] },
  size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  publicId: { type: String, required: true, trim: true, maxlength: 500, match: /^campusswap\/notices\// },
  resourceType: { type: String, required: true, enum: ['image', 'raw'] },
  secureUrl: { type: String, required: true, trim: true, maxlength: 2048, validate: { validator: safeHttps, message: 'Attachment URL must be safe HTTPS' } },
  kind: { type: String, required: true, enum: ['image', 'pdf', 'docx'] },
  uploadedAt: { type: Date, required: true, default: Date.now }
}, { _id: true });

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  content: { type: String, required: true, trim: true, maxlength: 10000 },
  category: { type: String, required: true, enum: NOTICE_CATEGORIES, default: 'general' },
  priority: { type: String, required: true, enum: NOTICE_PRIORITIES, default: 'normal' },
  status: { type: String, required: true, enum: NOTICE_STATUSES, default: 'draft' },
  targetScope: { type: String, required: true, enum: NOTICE_TARGET_SCOPES, default: 'college' },
  targetPrograms: [{ type: String, enum: programCodes, trim: true, uppercase: true }],
  targetSemester: { type: Number, min: 1, max: 8, default: null },
  attachmentUrl: { type: String, default: null, trim: true, maxlength: 2048, validate: { validator: safeHttps, message: 'attachmentUrl must be a safe HTTPS URL' } },
  attachmentLabel: { type: String, default: '', trim: true, maxlength: 100 },
  attachments: { type: [attachmentSchema], default: [], validate: { validator: (value) => value.length <= 5, message: 'A notice can contain at most 5 attachments' } },
  sourceUrl: { type: String, default: null, trim: true, maxlength: 2048, validate: { validator: safeHttps, message: 'sourceUrl must be a safe HTTPS URL' } },
  sourceLabel: { type: String, default: '', trim: true, maxlength: 100 },
  publishedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: { type: Date, default: null }
}, { timestamps: true });

noticeSchema.pre('validate', function validateTargeting() {
  this.targetPrograms = [...new Set(this.targetPrograms || [])];
  if (this.targetScope === 'college' && (this.targetPrograms.length || this.targetSemester != null)) this.invalidate('targetScope', 'College notices cannot restrict program or semester');
  if (this.targetScope === 'program' && (!this.targetPrograms.length || this.targetSemester != null)) this.invalidate('targetScope', 'Program notices require programs and cannot restrict semester');
  if (this.targetScope === 'semester' && (!this.targetPrograms.length || this.targetSemester == null)) this.invalidate('targetScope', 'Semester notices require programs and semester');
  if (this.status === 'published' && !this.publishedAt) this.invalidate('publishedAt', 'Published notices require publishedAt');
  if (this.status === 'archived' && !this.archivedAt) this.invalidate('archivedAt', 'Archived notices require archivedAt');
});

noticeSchema.index({ status: 1, expiresAt: 1, targetScope: 1, targetPrograms: 1, targetSemester: 1, publishedAt: -1, _id: -1 });
noticeSchema.index({ status: 1, category: 1, priority: 1, publishedAt: -1, _id: -1 });

export default mongoose.model('Notice', noticeSchema);
