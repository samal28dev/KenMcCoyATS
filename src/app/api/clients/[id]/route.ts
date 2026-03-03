import { NextResponse } from 'next/server'
import dbConnect from '../../../../lib/db'
import Client from '../../../../models/Client'
import Position from '../../../../models/Position'
import { verifyAuth } from '../../../../lib/auth'
import { canPerformAction } from '../../../../lib/role-scope'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/clients/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const client = await Client.findById(id)
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email')
            .lean()

        if (!client) return NextResponse.json({ message: 'Client not found' }, { status: 404 })

        // Get positions for this client
        const positions = await Position.find({ clientId: id })
            .populate('assignedTo', 'name email role')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json({ ...client, positions })
    } catch (error) {
        console.error('Client get error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/clients/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Permission check — only super_admin, operations_head, team_lead can update clients
        if (!canPerformAction(user.role, 'update', 'client')) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const { id } = await params
        const body = await req.json()

        const client = await Client.findByIdAndUpdate(id, { $set: body }, { new: true })
            .populate('assignedTo', 'name email role')
            .lean()

        if (!client) return NextResponse.json({ message: 'Client not found' }, { status: 404 })

        emitRealtimeEvent('client:updated', { clientId: id, actorId: user._id.toString() })

        // Notify hierarchy on status change or reassignment
        if (body.status || body.assignedTo) {
            await notifyHierarchy({
                actorId: user._id,
                actorRole: user.role,
                actorName: user.name || 'Team Member',
                action: 'client_update',
                entityType: 'client',
                entityId: id,
                entityName: (client as any).companyName || 'Client',
                message: body.status
                    ? `Client "${(client as any).companyName}" status changed to ${body.status}`
                    : `Client "${(client as any).companyName}" has been updated`,
            })
        }

        await writeAuditLog({
            action: 'update',
            entityType: 'client',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: body,
        })

        return NextResponse.json(client)
    } catch (error) {
        console.error('Client update error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/clients/[id] — soft delete (set inactive)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Only super_admin and operations_head can deactivate clients
        if (!['super_admin', 'operations_head'].includes(user.role)) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const { id } = await params

        const client = await Client.findByIdAndUpdate(id, { status: 'inactive' }, { new: true }).lean()
        if (!client) return NextResponse.json({ message: 'Client not found' }, { status: 404 })

        emitRealtimeEvent('client:updated', { clientId: id, action: 'deactivated' })

        await writeAuditLog({
            action: 'deactivate',
            entityType: 'client',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
        })

        return NextResponse.json({ message: 'Client deactivated', client })
    } catch (error) {
        console.error('Client delete error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
