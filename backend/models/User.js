import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    enrollmentNumber: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    collegeName: { type: String, default: '', trim: true },
    course: { type: String, default: '', trim: true },
    yearSemester: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true, maxlength: 300 },
    interests: [{ type: String, trim: true }],
    skills: [{ type: String, trim: true }],
    profilePicture: { type: String, default: '' },
    phoneNumber: { type: String, default: '', trim: true, maxlength: 20 },
    whatsappNumber: { type: String, default: '', trim: true, maxlength: 20 },
    contactVisibility: { type: String, enum: ['connections', 'private'], default: 'connections' },
    trustScore: { type: Number, default: 0, min: 0, max: 100 },
    isVerifiedStudent: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
    savedListings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Listing' }],
    bookmarkedNotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }]
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
