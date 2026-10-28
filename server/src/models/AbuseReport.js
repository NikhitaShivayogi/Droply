import mongoose from 'mongoose';

const abuseReportSchema = new mongoose.Schema({
  dropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Drop', default: null },
  category: { type: String, required: true, enum: ['copyright', 'malware', 'abuse', 'other'] },
  description: { type: String, required: true, maxlength: 4000 },
  email: { type: String, maxlength: 254, default: '' },
  status: { type: String, enum: ['open', 'reviewing', 'closed'], default: 'open' }
}, { timestamps: true });

export default mongoose.model('AbuseReport', abuseReportSchema);
