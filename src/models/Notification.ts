import mongoose from 'mongoose'

const NotificationSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: [
            'status_change', 'comment_added', 'candidate_assigned',
            'candidate_attached', 'task_assigned', 'agreement_expiring',
            'mention', 'position_update', 'client_update'
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: { type: String, enum: ['candidate', 'position', 'client', 'task'] },
    entityId: { type: String },
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.index({ recipientId: 1 });
NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export default mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
