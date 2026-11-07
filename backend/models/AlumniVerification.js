import mongoose from 'mongoose';

const alumniVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, unique: true, sparse: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: null },
  emailTokenHash: { type: String, default: null },
  emailVerificationClaimedAt: { type: Date, default: null },
  emailTokenExpiresAt: { type: Date, default: null, expires: 0 },
  emailLastSentAt: { type: Date, default: null },
  graduationYear: { type: Number, required: true },
  department: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true },
  previousEnrollmentNumber: { type: String, default: '', trim: true },
  company: { type: String, default: '', trim: true },
  jobTitle: { type: String, default: '', trim: true },
  status: { type: String, enum: ['email_pending', 'pending', 'approved', 'rejected'], default: 'email_pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  reviewReason: { type: String, default: '', trim: true, maxlength: 500 }
}, { timestamps: true });

export default mongoose.model('AlumniVerification', alumniVerificationSchema);
