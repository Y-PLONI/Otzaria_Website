import mongoose from 'mongoose';

const UploadSchema = new mongoose.Schema({
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = העלאה אנונימית
  bookName: { type: String, required: true },
  originalFileName: { type: String },
  content: { type: String }, // תוכן הקובץ
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.models.Upload || mongoose.model('Upload', UploadSchema);