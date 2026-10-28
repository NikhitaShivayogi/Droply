import mongoose from 'mongoose';

const dropSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true, index: true },
  managementHash: { type: String, required: true },
  title: { type: String, trim: true, maxlength: 120, default: '' },
  text: { type: String, maxlength: 100000, default: '' },
  status: { type: String, enum: ['uploading', 'ready', 'expired', 'deleted'], default: 'uploading', index: true },
  expiresAt: { type: Date, required: true, index: true },
  downloadLimit: { type: Number, min: 1, default: null },
  downloadCount: { type: Number, default: 0 },
  activeDownloads: { type: Number, default: 0 },
  totalSize: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Drop', dropSchema);
