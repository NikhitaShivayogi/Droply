import mongoose from 'mongoose';

const dropFileSchema = new mongoose.Schema({
  dropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drop', required: true, index: true },
  objectKey: { type: String, required: true, unique: true },
  uploadId: { type: String, default: '' },
  name: { type: String, required: true, maxlength: 255 },
  contentType: { type: String, required: true, maxlength: 255 },
  size: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['uploading', 'ready', 'failed'], default: 'uploading' },
  checksum: { type: String, default: '' },
  fileData: { type: Buffer, default: null } // For in-memory storage (development)
}, { timestamps: true });

export default mongoose.model('DropFile', dropFileSchema);
