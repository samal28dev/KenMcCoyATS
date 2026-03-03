import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Client from '../../../models/Client'
import { verifyAuth } from '../../../lib/auth'
import { getUserScope, canPerformAction } from '../../../lib/role-scope'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'
import { logActivity } from '@/lib/activity-feed'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/clients — list with optional filters
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')

        const filter: any = {}
        if (status) filter.status = status
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.companyName = { $regex: escaped, $options: 'i' }
        }

        // Apply role-based scoping
        const scope = await getUserScope(user._id.toString(), user.role, 'assignedTo')
        Object.assign(filter, scope.filter)

        const clients = await Client.find(filter)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json(clients)
    } catch (error) {
        console.error('Clients list error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/clients — create
export async function POST(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!canPerformAction(user.role, 'create', 'client')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const body = await req.json()

        const client = await Client.create({
            ...body,
            createdBy: user._id,
            assignedTo: body.assignedTo || user._id,
        })

        emitRealtimeEvent('client:created', {
            clientId: client._id.toString(),
            clientName: client.companyName,
            actorId: user._id.toString(),
        })

        // Notify hierarchy about new client
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: user.name || 'Team Member',
            action: 'client_update',
            entityType: 'client',
            entityId: client._id.toString(),
            entityName: client.companyName,
            message: `New client created: "${client.companyName}"`,
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'client_created',
            targetType: 'client',
            targetId: client._id.toString(),
            targetName: client.companyName,
        })

        await writeAuditLog({
            action: 'create',
            entityType: 'client',
            entityId: client._id.toString(),
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { companyName: client.companyName },
        })

        return NextResponse.json(client, { status: 201 })
    } catch (error: any) {
        console.error('Client create error:', error)
        return NextResponse.json({ message: error.message || 'Failed to create client' }, { status: 500 })
    }
}
