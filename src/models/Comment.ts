import mongoose from 'mongoose'

const CommentSchema = new mongoose.Schema({
    entityType: { type: String, enum: ['candidate', 'position', 'client', 'task'], required: true },
    entityId: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: [{
        name: { type: String },
        url: { type: String },
        type: { type: String }
    }],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    reactions: [{
        emoji: { type: String },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
}, { timestamps: true });

CommentSchema.index({ entityType: 1, entityId: 1 });
CommentSchema.index({ authorId: 1 });
CommentSchema.index({ parentId: 1 });

export default mongoose.models.Comment || mongoose.model('Comment', CommentSchema);
