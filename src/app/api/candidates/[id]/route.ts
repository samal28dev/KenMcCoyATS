import { NextResponse } from 'next/server'
import dbConnect from '../../../../lib/db'
import Candidate from '../../../../models/Candidate'
import CandidatePosition from '../../../../models/CandidatePosition'
import Timeline from '../../../../models/Timeline'
import { verifyAuth } from '../../../../lib/auth'
import { notifyHierarchy, notifyUser } from '../../../../lib/notify'
import { emitRealtimeEvent } from '@/lib/socket'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/candidates/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const candidate = await Candidate.findById(id)
            .populate('assignedTo', 'name email role')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .populate('createdBy', 'name email')
            .populate('lastParsedBy', 'name email')
            .populate('lockedByPosition', 'title')
            .lean()

        if (!candidate) return NextResponse.json({ message: 'Candidate not found' }, { status: 404 })

        // Get all positions this candidate is attached to
        const positions = await CandidatePosition.find({ candidateId: id })
            .populate('positionId', 'title status')
            .populate('clientId', 'companyName')
            .sort({ createdAt: -1 })
            .lean()

        // Get timeline entries
        const timeline = await Timeline.find({ candidateId: id })
            .populate('performedBy', 'name')
            .sort({ date: -1 })
            .lean()

        return NextResponse.json({ ...candidate, positions, timeline })
    } catch (error) {
        console.error('Candidate get error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/candidates/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params
        const body = await req.json()

        // Email validation
        if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return NextResponse.json({ message: 'Invalid email format' }, { status: 400 })
        }

        // Auto-calculate age from DOB
        if (body.dob) {
            const dob = new Date(body.dob)
            const today = new Date()
            let age = today.getFullYear() - dob.getFullYear()
            const monthDiff = today.getMonth() - dob.getMonth()
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
            body.age = age
        }

        // Admin lock/unlock toggle — spec: "system admin can lock or unlock"
        if (body.toggleLock !== undefined && ['super_admin', 'operations_head'].includes(user.role)) {
            if (body.toggleLock === false) {
                body.isLocked = false
                body.lockedByPosition = null
                body.lockedAt = null
            } else {
                body.isLocked = true
                body.lockedAt = new Date()
            }
            delete body.toggleLock
        }

        // Check candidate lock before attaching to position
        if (body.positionId) {
            const existing = await Candidate.findById(id).lean() as any
            if (existing?.isLocked && existing.lockedByPosition?.toString() !== body.positionId) {
                return NextResponse.json({
                    message: `Candidate is locked to another position. Locked since ${existing.lockedAt?.toISOString()?.split('T')[0]}`,
                }, { status: 423 })
            }
            // Lock the candidate to this position
            body.isLocked = true
            body.lockedByPosition = body.positionId
            body.lockedAt = new Date()
        }

        // Get old candidate to detect status change
        const oldCandidate = await Candidate.findById(id).lean() as any

        const candidate = await Candidate.findByIdAndUpdate(id, { $set: body }, { new: true })
            .populate('assignedTo', 'name email role')
            .lean() as any

        if (!candidate) return NextResponse.json({ message: 'Candidate not found' }, { status: 404 })

        // Auto-notify hierarchy on status change
        if (body.status && oldCandidate && body.status !== oldCandidate.status) {
            await notifyHierarchy({
                actorId: user._id,
                actorRole: user.role,
                actorName: 'Team Member',
                action: 'status_change',
                entityType: 'candidate',
                entityId: id,
                entityName: candidate.name,
                message: `Candidate "${candidate.name}" status changed from ${oldCandidate.status} to ${body.status}`,
            })
        }

        // Auto-notify on assign/reassign
        if (body.assignedTo && oldCandidate && body.assignedTo !== oldCandidate.assignedTo?.toString()) {
            await notifyHierarchy({
                actorId: user._id,
                actorRole: user.role,
                actorName: 'Team Member',
                action: 'candidate_assigned',
                entityType: 'candidate',
                entityId: id,
                entityName: candidate.name,
                message: `Candidate "${candidate.name}" has been assigned/reassigned`,
            })
            // Also notify the new assignee directly
            await notifyUser({
                senderId: user._id,
                recipientId: body.assignedTo,
                action: 'candidate_assigned',
                entityType: 'candidate',
                entityId: id,
                title: 'Candidate Assigned to You',
                message: `Candidate "${candidate.name}" has been assigned to you`,
            })
        }

        // Real-time event
        emitRealtimeEvent('candidate:updated', {
            candidateId: id,
            candidateName: candidate.name,
            actorId: user._id.toString(),
        })

        return NextResponse.json(candidate)
    } catch (error) {
        console.error('Candidate update error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/candidates/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        // Only super_admin and operations_head can delete candidates
        if (!['super_admin', 'operations_head'].includes(user.role)) {
            return NextResponse.json({ message: 'Insufficient permissions to delete candidates' }, { status: 403 })
        }

        await dbConnect()
        const { id } = await params

        await Candidate.findByIdAndDelete(id)
        await CandidatePosition.deleteMany({ candidateId: id })
        await Timeline.deleteMany({ candidateId: id })

        emitRealtimeEvent('candidate:updated', { candidateId: id, action: 'deleted' })

        await writeAuditLog({
            action: 'delete',
            entityType: 'candidate',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
        })

        return NextResponse.json({ message: 'Candidate deleted' })
    } catch (error) {
        console.error('Candidate delete error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
