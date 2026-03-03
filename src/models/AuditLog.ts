import mongoose from 'mongoose'

const AuditLogSchema = new mongoose.Schema({
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true },
    changes: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ performedBy: 1 });
AuditLogSchema.index({ timestamp: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
