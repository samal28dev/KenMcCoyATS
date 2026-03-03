import AuditLog from '@/models/AuditLog'

interface AuditParams {
    action: string
    entityType: string
    entityId: string
    performedBy: string
    performedByName: string
    changes?: Record<string, unknown>
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
    try {
        await AuditLog.create({
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            performedBy: params.performedBy,
            performedByName: params.performedByName,
            changes: params.changes ?? {},
        })
    } catch (err) {
        console.error('AuditLog write failed:', err)
    }
}
