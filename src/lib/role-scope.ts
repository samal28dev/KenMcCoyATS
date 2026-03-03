import dbConnect from './db'
import User from '../models/User'

/**
 * Role hierarchy: Super Admin > Operations Head > Team Lead > Recruiter
 * 
 * Data scoping rules:
 * - super_admin / operations_head: See ALL data
 * - team_lead: See own data + data from team members (recruiters assigned to them)
 * - recruiter: See only own assigned data
 */

export type RoleScope = {
    filter: Record<string, any>  // MongoDB filter to apply
    canSeeAll: boolean
    role: string
    userId: string
}

const ADMIN_ROLES = ['super_admin', 'operations_head', 'superadmin', 'admin']

export async function getUserScope(
    userId: string,
    role: string,
    fieldName: string = 'assignedTo'  // which field to scope on
): Promise<RoleScope> {
    if (ADMIN_ROLES.includes(role)) {
        return { filter: {}, canSeeAll: true, role, userId }
    }

    if (role === 'team_lead') {
        // Team lead sees own data + team members' data
        await dbConnect()
        const teamLead = await User.findById(userId).select('teamMembers').lean() as any
        const teamMemberIds = teamLead?.teamMembers || []
        const allIds = [userId, ...teamMemberIds.map((id: any) => id.toString())]

        return {
            filter: { [fieldName]: { $in: allIds } },
            canSeeAll: false,
            role,
            userId,
        }
    }

    // Recruiter — only own data
    return {
        filter: { [fieldName]: userId },
        canSeeAll: false,
        role,
        userId,
    }
}

/**
 * Check if a user can perform an action based on role hierarchy
 */
export function canPerformAction(
    userRole: string,
    action: 'create' | 'update' | 'delete' | 'assign' | 'view',
    entity: 'client' | 'position' | 'candidate' | 'task' | 'user'
): boolean {
    const permissions: Record<string, Record<string, string[]>> = {
        client: {
            create: ['super_admin', 'operations_head', 'team_lead'],
            update: ['super_admin', 'operations_head', 'team_lead'],
            delete: ['super_admin', 'operations_head'],
            assign: ['super_admin', 'operations_head'],
            view: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
        },
        position: {
            create: ['super_admin', 'operations_head', 'team_lead'],
            update: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            delete: ['super_admin', 'operations_head'],
            assign: ['super_admin', 'operations_head', 'team_lead'],
            view: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
        },
        candidate: {
            create: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            update: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            delete: ['super_admin', 'operations_head'],
            assign: ['super_admin', 'operations_head', 'team_lead'],
            view: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
        },
        task: {
            create: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            update: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            delete: ['super_admin', 'operations_head', 'team_lead'],
            assign: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
            view: ['super_admin', 'operations_head', 'team_lead', 'recruiter'],
        },
        user: {
            create: ['super_admin', 'operations_head'],
            update: ['super_admin', 'operations_head'],
            delete: ['super_admin'],
            assign: ['super_admin', 'operations_head'],
            view: ['super_admin', 'operations_head', 'team_lead'],
        },
    }

    const entityPerms = permissions[entity]
    if (!entityPerms) return false

    const allowedRoles = entityPerms[action]
    if (!allowedRoles) return false

    return allowedRoles.includes(userRole)
}
