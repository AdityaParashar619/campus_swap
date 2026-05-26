import mongoose from 'mongoose';

const bountySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

bountySchema.index({ createdAt: -1 });

export default mongoose.model('Bounty', bountySchema);
