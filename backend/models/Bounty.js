import mongoose from 'mongoose';

const bountySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Bounty', bountySchema);
