import mongoose from 'mongoose';

// One detected lesion. Box is normalised (0-1) so the client can overlay it on
// any rendered size of the input image without knowing the original pixels.
const lesionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    confidence: { type: Number, required: true },
    bbox: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      w: { type: Number, required: true },
      h: { type: Number, required: true },
    },
    region: { type: String, default: '' },
    centroid: { x: Number, y: Number },
    areaPx: { type: Number, default: 0 },
  },
  { _id: false }
);

const scanSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inputImage: { type: String, required: true },
    // The 1024px preprocessed frame the model actually ran on. Lesion boxes are
    // normalised against this, so it is what the report viewer renders.
    displayImage: { type: String, default: '' },
    overlayImage: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'complete', 'failed'], default: 'pending' },
    error: { type: String, default: '' },
    lesions: { type: [lesionSchema], default: [] },
    lesionCount: { type: Number, default: 0 },
    countsByLabel: { type: Map, of: Number, default: {} },
    imageWidth: { type: Number, default: 0 },
    imageHeight: { type: Number, default: 0 },
    modelName: { type: String, default: '' },
    device: { type: String, default: '' },
    maPath: { type: String, default: '' },
    inferenceMs: { type: Number, default: 0 },
    summary: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Scan', scanSchema);
