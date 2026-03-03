import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import CandidatePosition from '@/models/CandidatePosition'
import Candidate from '@/models/Candidate'
import Position from '@/models/Position'
import Timeline from '@/models/Timeline'
import { notifyHierarchy } from '@/lib/notify'
import { emitRealtimeEvent } from '@/lib/socket'
import { logActivity } from '@/lib/activity-feed'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/candidate-positions — list all, with filters
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const candidateId = searchParams.get('candidateId')
        const positionId = searchParams.get('positionId')
        const status = searchParams.get('status')

        const filter: any = {}
        if (candidateId) filter.candidateId = candidateId
        if (positionId) filter.positionId = positionId
        if (status) filter.status = status

        const records = await CandidatePosition.find(filter)
            .populate('candidateId', 'name email phone designation currentCompany resumeFile')
            .populate('positionId', 'title status')
            .populate('clientId', 'companyName')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json(records)
    } catch (error) {
        console.error('CandidatePosition list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/candidate-positions — assign a candidate to a position
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { candidateId, positionId } = body

        if (!candidateId || !positionId) {
            return NextResponse.json({ error: 'candidateId and positionId are required' }, { status: 400 })
        }

        // Check if already assigned
        const existing = await CandidatePosition.findOne({ candidateId, positionId })
        if (existing) {
            return NextResponse.json({ error: 'Candidate is already assigned to this position' }, { status: 409 })
        }

        // Get position to find clientId
        const position = await Position.findById(positionId).lean() as any
        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }

        // Atomic lock: only succeeds if candidate is NOT already locked
        // This prevents race conditions when two users try to assign simultaneously
        const lockResult = await Candidate.findOneAndUpdate(
            {
                _id: candidateId,
                $or: [
                    { isLocked: false },
                    { isLocked: { $exists: false } },
                    { isLocked: null },
                ]
            },
            {
                $set: {
                    isLocked: true,
                    lockedByPosition: positionId,
                    lockedAt: new Date(),
                    positionId: positionId,
                    clientId: position.clientId,
                }
            },
            { new: true }
        )

        if (!lockResult) {
            // Either candidate doesn't exist or is already locked
            const candidate = await Candidate.findById(candidateId).lean() as any
            if (!candidate) {
                return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
            }
            return NextResponse.json({
                error: 'Candidate is already locked to another position. Release them first before reassigning.',
            }, { status: 409 })
        }

        // Create the assignment with initial status 'submitted'
        const cp = await CandidatePosition.create({
            candidateId,
            positionId,
            clientId: position.clientId,
            status: 'submitted',
            createdBy: user._id,
        })

        // Create timeline entry
        try {
            await Timeline.create({
                candidateId,
                positionId,
                type: 'assignment',
                title: 'Assigned to Position',
                description: `Assigned to position: ${position.title} with status Submitted`,
                status: 'completed',
                performedBy: user._id,
                date: new Date(),
                notes: `Assigned to position: ${position.title}`,
            })
        } catch (e) { /* timeline is optional */ }

        // Notify hierarchy
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: user.name || 'User',
            action: 'candidate_assigned',
            entityType: 'candidate',
            entityId: candidateId,
            entityName: lockResult.name,
            message: `${lockResult.name} has been assigned to position "${position.title}" with status Submitted`,
        })

        const populated = await CandidatePosition.findById(cp._id)
            .populate('candidateId', 'name email')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .lean()

        // Emit real-time event
        emitRealtimeEvent('candidate:assigned', {
            candidateId,
            positionId,
            candidateName: lockResult.name,
            positionTitle: position.title,
            actorId: user._id.toString(),
            actorName: user.name || 'User',
        })
        emitRealtimeEvent('dashboard:refresh', { reason: 'candidate_assigned' })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'candidate_attached',
            targetType: 'candidate',
            targetId: candidateId,
            targetName: lockResult.name,
            metadata: { positionId, positionTitle: position.title },
        })

        return NextResponse.json(populated, { status: 201 })
    } catch (error) {
        console.error('CandidatePosition create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/candidate-positions — update pipeline status
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { id, status, remarks, joiningDate, joiningLocation } = body

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 })
        }

        const validStatuses = [
            'submitted', 'shortlisted', 'interview_l1', 'interview_l2',
            'interview_l3', 'offered', 'joined', 'rejected', 'on_hold', 'withdrawn'
        ]
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
        }

        const old = await CandidatePosition.findById(id)
            .populate('candidateId', 'name')
            .populate('positionId', 'title')
            .lean() as any

        if (!old) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        const updates: any = { status }
        if (remarks !== undefined) updates.remarks = remarks
        if (joiningDate) updates.joiningDate = joiningDate
        if (joiningLocation) updates.joiningLocation = joiningLocation

        const updated = await CandidatePosition.findByIdAndUpdate(id, updates, { new: true })
            .populate('candidateId', 'name email phone designation')
            .populate('positionId', 'title status')
            .populate('clientId', 'companyName')
            .lean()

        // Create timeline entry
        try {
            await Timeline.create({
                candidateId: old.candidateId._id,
                positionId: old.positionId._id,
                type: 'status_change',
                title: `${old.status.replace(/_/g, ' ')} → ${status.replace(/_/g, ' ')}`,
                description: remarks || `Pipeline status changed from ${old.status.replace(/_/g, ' ')} to ${status.replace(/_/g, ' ')} for position: ${old.positionId.title}`,
                status: 'completed',
                performedBy: user._id,
                date: new Date(),
                notes: remarks || `Status: ${old.status} → ${status}`,
            })
        } catch (e) { /* timeline is optional */ }

        // Notify hierarchy about status change
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: user.name || 'User',
            action: 'status_change',
            entityType: 'candidate',
            entityId: old.candidateId._id.toString(),
            entityName: old.candidateId.name,
            message: `${old.candidateId.name} pipeline status changed: ${old.status} → ${status} (Position: ${old.positionId.title})`,
        })

        // If status is 'joined', update candidate status too
        if (status === 'joined') {
            await Candidate.findByIdAndUpdate(old.candidateId._id, { status: 'joined' })
        }

        // Emit real-time event
        emitRealtimeEvent('pipeline:updated', {
            candidateId: old.candidateId._id.toString(),
            candidateName: old.candidateId.name,
            positionTitle: old.positionId.title,
            oldStatus: old.status,
            newStatus: status,
            actorId: user._id.toString(),
            actorName: user.name || 'User',
        })
        emitRealtimeEvent('dashboard:refresh', { reason: 'pipeline_status_change' })

        await writeAuditLog({
            action: 'status_change',
            entityType: 'candidate_position',
            entityId: id,
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { oldStatus: old.status, newStatus: status, candidateName: old.candidateId.name, positionTitle: old.positionId.title },
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'status_changed',
            targetType: 'candidate',
            targetId: old.candidateId._id.toString(),
            targetName: old.candidateId.name,
            metadata: { oldStatus: old.status, newStatus: status, positionTitle: old.positionId.title },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('CandidatePosition update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/candidate-positions — remove assignment
export async function DELETE(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const cp = await CandidatePosition.findById(id).lean() as any
        if (!cp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        await CandidatePosition.findByIdAndDelete(id)

        // Unlock candidate
        const otherAssignments = await CandidatePosition.countDocuments({ candidateId: cp.candidateId })
        if (otherAssignments === 0) {
            await Candidate.findByIdAndUpdate(cp.candidateId, {
                isLocked: false,
                lockedByPosition: null,
                lockedAt: null,
            })
        }

        // Emit real-time event
        emitRealtimeEvent('candidate:updated', {
            candidateId: cp.candidateId.toString(),
            positionId: cp.positionId.toString(),
            action: 'unassigned',
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('CandidatePosition delete error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
