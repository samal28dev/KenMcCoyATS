import ActivityFeed from '@/models/ActivityFeed'

type ActivityAction =
    | 'candidate_added' | 'candidate_attached' | 'status_changed'
    | 'comment_added' | 'client_created' | 'position_created'
    | 'task_created' | 'task_completed' | 'document_uploaded' | 'email_sent'

type TargetType = 'candidate' | 'position' | 'client' | 'task'

interface LogActivityParams {
    actorId: string
    actorName: string
    action: ActivityAction
    targetType: TargetType
    targetId: string
    targetName: string
    metadata?: Record<string, unknown>
}

/**
 * Writes an entry to the ActivityFeed collection.
 * Fire-and-forget – failures are logged but never throw.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
    try {
        await ActivityFeed.create({
            actor: { id: params.actorId, name: params.actorName },
            action: params.action,
            target: { type: params.targetType, id: params.targetId, name: params.targetName },
            metadata: params.metadata ?? {},
        })
    } catch (err) {
        // Activity feed is non-critical — never break the parent request
        console.error('ActivityFeed write failed:', err)
    }
}
