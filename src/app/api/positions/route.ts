import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Position from '../../../models/Position'
import { verifyAuth } from '../../../lib/auth'
import { getUserScope, canPerformAction } from '../../../lib/role-scope'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'
import { logActivity } from '@/lib/activity-feed'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/positions — list with filters
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const clientId = searchParams.get('clientId')
        const search = searchParams.get('search')
        const assignedTo = searchParams.get('assignedTo')

        const filter: any = {}
        const statuses = searchParams.getAll('status')
        if (statuses.length === 1) filter.status = statuses[0]
        else if (statuses.length > 1) filter.status = { $in: statuses }
        if (clientId) filter.clientId = clientId
        if (assignedTo) filter.assignedTo = assignedTo
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.title = { $regex: escaped, $options: 'i' }
        }

        // Apply role-based scoping
        const scope = await getUserScope(user._id.toString(), user.role, 'assignedTo')
        Object.assign(filter, scope.filter)

        const positions = await Position.find(filter)
            .populate('clientId', 'companyName')
            .populate('assignedTo', 'name email role')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json(positions)
    } catch (error) {
        console.error('Positions list error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/positions
export async function POST(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!canPerformAction(user.role, 'create', 'position')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const body = await req.json()

        const position = await Position.create({
            ...body,
            createdBy: user._id,
            assignedTo: body.assignedTo || user._id,
        })

        emitRealtimeEvent('position:created', {
            positionId: position._id.toString(),
            positionTitle: position.title,
            actorId: user._id.toString(),
        })
        emitRealtimeEvent('dashboard:refresh', { reason: 'position_created' })

        // Notify hierarchy about new position
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: user.name || 'Team Member',
            action: 'position_update',
            entityType: 'position',
            entityId: position._id.toString(),
            entityName: position.title,
            message: `New position created: "${position.title}"`,
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'position_created',
            targetType: 'position',
            targetId: position._id.toString(),
            targetName: position.title,
        })

        await writeAuditLog({
            action: 'create',
            entityType: 'position',
            entityId: position._id.toString(),
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { title: position.title },
        })

        return NextResponse.json(position, { status: 201 })
    } catch (error: any) {
        console.error('Position create error:', error)
        return NextResponse.json({ message: error.message || 'Failed to create position' }, { status: 500 })
    }
}
