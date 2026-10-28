import mongoose from 'mongoose';

const downloadEventSchema = new mongoose.Schema({
  dropId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  outcome: { type: String, required: true, enum: ['completed', 'interrupted'] },
  occurredAt: { type: Date, required: true, default: Date.now }
}, { versionKey: false });

downloadEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('DownloadEvent', downloadEventSchema);
