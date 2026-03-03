import mongoose from 'mongoose'

const TimelineSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    date: { type: Date, default: Date.now },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['completed', 'scheduled', 'pending'], default: 'pending' },
    notes: { type: String },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TimelineSchema.index({ candidateId: 1 });

export default mongoose.models.Timeline || mongoose.model('Timeline', TimelineSchema);
