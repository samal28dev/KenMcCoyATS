import mongoose from 'mongoose'

const PositionSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    title: { type: String, required: true },

    // Storage paths (migrating from Convex storage IDs)
    jdFile: { type: String },
    jdFilename: { type: String },
    jdDocVersion: { type: String },
    jdPdfVersion: { type: String },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    status: {
        type: String,
        enum: ['new', 'work-in-progress', 'closed'],
        default: 'new'
    },

    description: { type: String },
    requirements: [{ type: String }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
    timestamps: true // createdAt and updatedAt
});

PositionSchema.index({ title: 'text' });
PositionSchema.index({ clientId: 1 });
PositionSchema.index({ status: 1 });
PositionSchema.index({ assignedTo: 1 });

export default mongoose.models.Position || mongoose.model('Position', PositionSchema);
