import mongoose from 'mongoose'

const EmailTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    type: {
        type: String,
        enum: ['interview_invitation', 'rejection', 'offer', 'follow_up',
            'candidate_introduction', 'client_update', 'custom']
    },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    variables: [{ type: String }],
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    useCount: { type: Number, default: 0 },
    lastUsed: { type: Date }
}, { timestamps: true });

EmailTemplateSchema.index({ category: 1 });
EmailTemplateSchema.index({ isActive: 1 });
EmailTemplateSchema.index({ type: 1 });

export default mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', EmailTemplateSchema);
