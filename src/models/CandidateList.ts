import mongoose from 'mongoose';

const CandidateListSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        default: '#3B82F6' // Default to blue
    },
    candidates: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for efficient querying by user
CandidateListSchema.index({ createdBy: 1 });

export default mongoose.models.CandidateList || mongoose.model('CandidateList', CandidateListSchema);
