import mongoose from 'mongoose'

const ActivityFeedSchema = new mongoose.Schema({
    actor: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        avatar: { type: String }
    },
    action: {
        type: String,
        enum: ['candidate_added', 'candidate_attached', 'status_changed', 'comment_added',
            'client_created', 'position_created', 'task_created', 'task_completed',
            'document_uploaded', 'email_sent'],
        required: true
    },
    target: {
        type: { type: String, enum: ['candidate', 'position', 'client', 'task'], required: true },
        id: { type: String, required: true },
        name: { type: String, required: true }
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

ActivityFeedSchema.index({ timestamp: -1 });
ActivityFeedSchema.index({ 'actor.id': 1 });

export default mongoose.models.ActivityFeed || mongoose.model('ActivityFeed', ActivityFeedSchema);
