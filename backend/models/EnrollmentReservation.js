import mongoose from 'mongoose';

const enrollmentReservationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  enrollmentNumber: { type: String, required: true, lowercase: true, trim: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

export default mongoose.model('EnrollmentReservation', enrollmentReservationSchema);
