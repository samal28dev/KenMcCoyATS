import { NextResponse } from 'next/server'
import dbConnect from '../../../../lib/db'
import Position from '../../../../models/Position'
import CandidatePosition from '../../../../models/CandidatePosition'
import Candidate from '../../../../models/Candidate'
import { verifyAuth } from '../../../../lib/auth'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/positions/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const position = await Position.findById(id)
            .populate('clientId', 'companyName contacts')
            .populate('assignedTo', 'name email role')
            .populate('createdBy', 'name email')
            .lean()

        if (!position) return NextResponse.json({ message: 'Position not found' }, { status: 404 })

        // Get candidates attached to this position
        const candidatePositions = await CandidatePosition.find({ positionId: id })
            .populate('candidateId', 'name email phone status location currentCompany designation resumeFile resumeFilename')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json({ ...position, candidatePositions })
    } catch (error) {
        console.error('Position get error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/positions/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        // Scope check: recruiters can only update positions assigned to them
        if (user.role === 'recruiter') {
            const existing = await Position.findById(id).select('assignedTo').lean() as any
            if (existing && existing.assignedTo?.toString() !== user._id.toString()) {
                return NextResponse.json({ message: 'You can only update positions assigned to you' }, { status: 403 })
            }
        }

        const body = await req.json()

        const position = await Position.findByIdAndUpdate(id, { $set: body }, { new: true })
            .populate('clientId', 'companyName')
            .populate('assignedTo', 'name email role')
            .lean()

        if (!position) return NextResponse.json({ message: 'Position not found' }, { status: 404 })

        emitRealtimeEvent('position:updated', { positionId: id, actorId: user._id.toString() })

        // Notify hierarchy on status change or reassignment
        if (body.status || body.assignedTo) {
            await notifyHierarchy({
                actorId: user._id,
                actorRole: user.role,
                actorName: user.name || 'Team Member',
                action: 'position_update',
                entityType: 'position',
                entityId: id,
                entityName: (position as any).title || 'Position',
                message: body.status
                    ? `Position "${(position as any).title}" status changed to ${body.status}`
                    : `Position "${(position as any).title}" has been reassigned`,
            })
        }

        await writeAuditLog({
            action: 'update',
            entityType: 'position',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: body,
        })

        return NextResponse.json(position)
    } catch (error) {
        console.error('Position update error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/positions/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Only super_admin, operations_head, or team_lead can close positions
        if (!['super_admin', 'operations_head', 'team_lead'].includes(user.role)) {
            return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const { id } = await params

        const position = await Position.findByIdAndUpdate(id, { status: 'closed' }, { new: true }).lean()
        if (!position) return NextResponse.json({ message: 'Position not found' }, { status: 404 })

        emitRealtimeEvent('position:updated', { positionId: id, action: 'closed' })
        emitRealtimeEvent('dashboard:refresh', { reason: 'position_closed' })

        await writeAuditLog({
            action: 'close',
            entityType: 'position',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
        })

        return NextResponse.json({ message: 'Position closed', position })
    } catch (error) {
        console.error('Position delete error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
