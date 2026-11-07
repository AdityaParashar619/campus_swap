import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  familyId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: { type: Date, default: null },
  replacedBy: { type: String, default: null },
  userAgent: { type: String, default: '' },
  ipAddress: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('RefreshSession', refreshSessionSchema);
