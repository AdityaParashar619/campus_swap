import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'General', trim: true },
    neededBy: { type: Date, default: null },
    location: { type: String, default: '', trim: true },
    status: { type: String, enum: ['open', 'fulfilled', 'closed'], default: 'open' },
    fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    responses: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, required: true, trim: true, maxlength: 500 },
        status: { type: String, enum: ['offered', 'accepted', 'declined'], default: 'offered' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

requestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('RequestPost', requestSchema);
