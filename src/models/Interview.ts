import mongoose from 'mongoose'

const InterviewSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    type: { type: String, required: true }, // L1, L2, L3, HR, etc.
    date: { type: Date, required: true },
    time: { type: String, required: true },
    duration: { type: String },
    interviewers: [{ type: String }],
    location: { type: String },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'no-show'], default: 'scheduled' },
    feedback: { type: String },
    rating: { type: Number },
    recommendation: { type: String, enum: ['proceed', 'hold', 'reject', 'strong_hire'] }
}, { timestamps: true });

InterviewSchema.index({ candidateId: 1 });
InterviewSchema.index({ positionId: 1 });
InterviewSchema.index({ status: 1 });
InterviewSchema.index({ date: 1 });

export default mongoose.models.Interview || mongoose.model('Interview', InterviewSchema);
