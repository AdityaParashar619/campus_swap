import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    condition: { type: String, enum: ['new', 'like_new', 'good', 'fair'], default: 'good' },
    images: [{ type: String, trim: true }],
    availability: { type: String, enum: ['available', 'sold', 'swapped'], default: 'available' },
    tags: [{ type: String, trim: true }],
    price: { type: Number, default: 0, min: 0 },
    isSwapAllowed: { type: Boolean, default: false },
    location: { type: String, default: '', trim: true },
    favoritesCount: { type: Number, default: 0, min: 0 },
    isHidden: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

listingSchema.index({ createdAt: -1 });
listingSchema.index({ category: 1 });
listingSchema.index({ availability: 1 });
listingSchema.index({ tags: 1 });
listingSchema.index({ title: 'text', description: 'text', tags: 'text' });

export default mongoose.model('Listing', listingSchema);
