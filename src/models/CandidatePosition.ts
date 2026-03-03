import mongoose from 'mongoose'

const CandidatePositionSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },

    status: {
        type: String,
        enum: [
            'submitted', 'shortlisted', 'interview_l1', 'interview_l2',
            'interview_l3', 'offered', 'joined', 'rejected', 'on_hold', 'withdrawn'
        ],
        required: true
    },

    joiningDate: { type: Date },
    joiningLocation: { type: String },
    remarks: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
    timestamps: true // createdAt and updatedAt
});

// Indexes for fast lookups
CandidatePositionSchema.index({ candidateId: 1 });
CandidatePositionSchema.index({ positionId: 1 });
CandidatePositionSchema.index({ clientId: 1 });
CandidatePositionSchema.index({ status: 1 });
// Compound index to ensure uniqueness of candidate per position
CandidatePositionSchema.index({ candidateId: 1, positionId: 1 }, { unique: true });

export default mongoose.models.CandidatePosition || mongoose.model('CandidatePosition', CandidatePositionSchema);
