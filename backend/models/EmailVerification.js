import mongoose from 'mongoose';

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  kind: { type: String, enum: ['student'], default: 'student' }
}, { timestamps: true });

emailVerificationSchema.index({ email: 1, kind: 1 }, { unique: true });

export default mongoose.model('EmailVerification', emailVerificationSchema);
