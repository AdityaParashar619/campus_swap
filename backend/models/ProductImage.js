import mongoose from 'mongoose';

const productImageSchema = new mongoose.Schema({
  secureUrl: { type: String, required: true, unique: true, maxlength: 2048 },
  publicId: { type: String, required: true, unique: true, maxlength: 300 },
  assetId: { type: String, default: '', maxlength: 100 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', default: null, index: true },
  status: { type: String, enum: ['pending', 'attached', 'cleanup_pending'], default: 'pending', index: true },
  format: { type: String, enum: ['jpeg', 'png', 'webp'], required: true },
  width: { type: Number, required: true, min: 200, max: 12000 },
  height: { type: Number, required: true, min: 200, max: 12000 },
  bytes: { type: Number, required: true, min: 1 },
  expiresAt: { type: Date, required: true, index: true },
  cleanupAttempts: { type: Number, default: 0, min: 0 },
  lastCleanupError: { type: String, default: '', maxlength: 120 }
}, { timestamps: true });

productImageSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model('ProductImage', productImageSchema);
