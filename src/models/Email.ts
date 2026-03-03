import mongoose from 'mongoose'

const EmailSchema = new mongoose.Schema({
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: String, required: true },
    cc: [{ type: String }],
    bcc: [{ type: String }],
    subject: { type: String, required: true },
    content: { type: String, required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
    status: { type: String, enum: ['draft', 'sent', 'delivered', 'failed'], default: 'draft' },
    sentAt: { type: Date },
    attachments: [{
        filename: { type: String },
        storagePath: { type: String },
        contentType: { type: String },
        size: { type: Number }
    }],
}, { timestamps: true });

EmailSchema.index({ candidateId: 1 });
EmailSchema.index({ from: 1 });
EmailSchema.index({ status: 1 });

export default mongoose.models.Email || mongoose.model('Email', EmailSchema);
