import mongoose from 'mongoose'

const FileStoreSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },  // actual file content
    fileType: { type: String, enum: ['resume', 'jd', 'document', 'template', 'other'], default: 'other' },
    hash: { type: String },  // MD5 for duplicate detection
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Link to parent entity
    entityType: { type: String, enum: ['candidate', 'position', 'client', ''] },
    entityId: { type: mongoose.Schema.Types.ObjectId },
}, {
    timestamps: true,
})

FileStoreSchema.index({ filename: 1 })
FileStoreSchema.index({ hash: 1 })
FileStoreSchema.index({ entityType: 1, entityId: 1 })
FileStoreSchema.index({ fileType: 1 })

export default mongoose.models.FileStore || mongoose.model('FileStore', FileStoreSchema)
