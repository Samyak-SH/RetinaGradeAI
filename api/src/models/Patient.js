import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0, max: 130 },
    sex: { type: String, enum: ['male', 'female', 'other', 'unknown'], default: 'unknown' },
    contact: { type: String, trim: true, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Name search is the primary lookup on the dashboard.
patientSchema.index({ doctor: 1, name: 'text' });

export default mongoose.model('Patient', patientSchema);
