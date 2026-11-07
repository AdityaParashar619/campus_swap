import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    enrollmentNumber: { type: String, default: null, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'alumni', 'faculty', 'department_coordinator', 'club_coordinator', 'grievance_officer', 'marketplace_moderator', 'college_admin', 'super_admin', 'admin'], default: 'student' },
    accountType: { type: String, enum: ['student', 'alumni', 'faculty', 'staff'], default: 'student' },
    department: { type: String, default: '', trim: true },
    branch: { type: String, default: '', trim: true },
    semester: { type: String, default: '', trim: true },
    graduationYear: { type: Number, min: 1950, max: 2200 },
    company: { type: String, default: '', trim: true },
    jobTitle: { type: String, default: '', trim: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    verificationMethod: { type: String, enum: ['legacy', 'college_email_otp', 'alumni_review', 'institutional_record'], default: 'legacy' },
    accountStatus: { type: String, enum: ['pending', 'active', 'suspended', 'blocked'], default: 'active' },
    statusReason: { type: String, default: '', trim: true, maxlength: 500 },
    permissions: { type: [String], default: [] },
    tokenVersion: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    departmentScope: { type: String, default: '', trim: true },
    clubScope: { type: String, default: '', trim: true },
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

userSchema.index({ enrollmentNumber: 1 }, { unique: true, partialFilterExpression: { enrollmentNumber: { $type: 'string' } } });

export default mongoose.model('User', userSchema);
