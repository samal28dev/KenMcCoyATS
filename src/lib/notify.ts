import dbConnect from './db'
import Notification from '../models/Notification'
import User from '../models/User'
import { emitRealtimeEvent } from './socket'

/**
 * Role hierarchy for notification escalation:
 * Recruiter → Team Lead → Operations Head → Super Admin
 */
const ROLE_HIERARCHY = ['recruiter', 'team_lead', 'operations_head', 'super_admin']

/**
 * Get all users higher in the hierarchy than the given role
 */
async function getHierarchyAbove(actorId: string, actorRole: string): Promise<string[]> {
    const roleIndex = ROLE_HIERARCHY.indexOf(actorRole)
    if (roleIndex === -1) return []

    const higherRoles = ROLE_HIERARCHY.slice(roleIndex + 1)
    if (higherRoles.length === 0) return []

    await dbConnect()
    const higherUsers = await User.find({
        role: { $in: higherRoles },
        _id: { $ne: actorId },
    }).select('_id').lean()

    return higherUsers.map((u: any) => u._id.toString())
}

/**
 * Create notifications for all users up the hierarchy
 */
export async function notifyHierarchy(params: {
    actorId: string
    actorRole: string
    actorName: string
    action: 'status_change' | 'comment_added' | 'candidate_assigned' | 'candidate_attached' |
    'task_assigned' | 'mention' | 'position_update' | 'client_update'
    entityType: 'candidate' | 'position' | 'client' | 'task'
    entityId: string
    entityName: string
    message: string
}) {
    try {
        await dbConnect()
        const recipientIds = await getHierarchyAbove(params.actorId, params.actorRole)

        if (recipientIds.length === 0) return

        const notifications = recipientIds.map(recipientId => ({
            recipientId,
            senderId: params.actorId,
            type: params.action,
            title: `${params.actorName} - ${formatAction(params.action)}`,
            message: params.message,
            entityType: params.entityType,
            entityId: params.entityId,
            isRead: false,
        }))

        await Notification.insertMany(notifications)

        // Push real-time notification to each recipient
        for (const recipientId of recipientIds) {
            emitRealtimeEvent('notification:new', {
                message: params.message,
                entityType: params.entityType,
                entityId: params.entityId,
            }, { toUserId: recipientId })
        }
    } catch (error) {
        console.error('Notification creation error:', error)
        // Don't throw — notification failures shouldn't break the main flow
    }
}

/**
 * Create a single notification for a specific user
 */
export async function notifyUser(params: {
    senderId: string
    recipientId: string
    action: 'status_change' | 'comment_added' | 'candidate_assigned' | 'candidate_attached' |
    'task_assigned' | 'agreement_expiring' | 'mention' | 'position_update' | 'client_update'
    entityType: 'candidate' | 'position' | 'client' | 'task'
    entityId: string
    title: string
    message: string
}) {
    try {
        await dbConnect()
        await Notification.create({
            recipientId: params.recipientId,
            senderId: params.senderId,
            type: params.action,
            title: params.title,
            message: params.message,
            entityType: params.entityType,
            entityId: params.entityId,
            isRead: false,
        })

        // Push real-time notification to the recipient
        emitRealtimeEvent('notification:new', {
            message: params.message,
            entityType: params.entityType,
            entityId: params.entityId,
        }, { toUserId: params.recipientId })
    } catch (error) {
        console.error('Single notification error:', error)
    }
}

function formatAction(action: string): string {
    const labels: Record<string, string> = {
        status_change: 'Status Change',
        comment_added: 'New Comment',
        candidate_assigned: 'Candidate Assigned',
        candidate_attached: 'Candidate Attached',
        task_assigned: 'New Task',
        agreement_expiring: 'Agreement Expiring',
        mention: 'You were mentioned',
        position_update: 'Position Updated',
        client_update: 'Client Updated',
    }
    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
