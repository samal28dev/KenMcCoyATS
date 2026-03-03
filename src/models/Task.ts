import mongoose from 'mongoose'

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    type: {
        type: String,
        enum: ['call', 'follow_up', 'interview_schedule', 'document_collection',
            'offer_release', 'joining_confirmation', 'agreement_renewal', 'custom'],
        default: 'custom'
    },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    relatedTo: {
        type: { type: String, enum: ['candidate', 'position', 'client'] },
        id: { type: String }
    },
    priority: { type: String, enum: ['urgent', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['new', 'in-process', 'hold', 'closed'], default: 'new' },
    dueDate: { type: Date, required: true },
    completedAt: { type: Date }
}, { timestamps: true });

TaskSchema.index({ assigneeId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ dueDate: 1 });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
