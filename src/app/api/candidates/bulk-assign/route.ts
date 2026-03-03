import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Candidate from '@/models/Candidate'
import Position from '@/models/Position'
import CandidatePosition from '@/models/CandidatePosition'
import Timeline from '@/models/Timeline'
import { emitRealtimeEvent } from '@/lib/socket'

/**
 * POST /api/candidates/bulk-assign — assign multiple candidates to a position.
 * Body: { candidateIds: string[], positionId: string }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { candidateIds, positionId } = body

        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            return NextResponse.json({ error: 'candidateIds array is required' }, { status: 400 })
        }
        if (!positionId) {
            return NextResponse.json({ error: 'positionId is required' }, { status: 400 })
        }
        if (candidateIds.length > 50) {
            return NextResponse.json({ error: 'Maximum 50 candidates per bulk assign' }, { status: 400 })
        }

        const position = await Position.findById(positionId).select('title').lean() as any
        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }

        // Check which candidates are already assigned
        const existing = await CandidatePosition.find({
            candidateId: { $in: candidateIds },
            positionId,
        }).select('candidateId').lean()
        const existingSet = new Set(existing.map((e: any) => e.candidateId.toString()))

        const toAssign = candidateIds.filter(id => !existingSet.has(id))
        const skipped = candidateIds.length - toAssign.length

        if (toAssign.length === 0) {
            return NextResponse.json({
                message: 'All selected candidates are already assigned to this position',
                assigned: 0,
                skipped,
            })
        }

        // Create CandidatePosition records
        const cpDocs = toAssign.map(cId => ({
            candidateId: cId,
            positionId,
            status: 'submitted',
            assignedBy: user._id,
        }))
        const inserted = await CandidatePosition.insertMany(cpDocs)

        // Update candidate statuses to 'screening' if currently 'new'
        await Candidate.updateMany(
            { _id: { $in: toAssign }, status: 'new' },
            { $set: { status: 'screening' } }
        )

        // Create timeline entries
        const candidates = await Candidate.find({ _id: { $in: toAssign } }).select('name').lean()
        const nameMap = new Map(candidates.map((c: any) => [c._id.toString(), c.name]))

        const timelineEntries = toAssign.map(cId => ({
            candidateId: cId,
            positionId,
            type: 'status_change',
            title: 'Assigned to Position',
            description: `Bulk assigned to position: ${position.title}`,
            status: 'completed',
            performedBy: user._id,
            date: new Date(),
            notes: `Bulk assignment to ${position.title}`,
        }))
        try { await Timeline.insertMany(timelineEntries) } catch { /* optional */ }

        // Realtime notification
        emitRealtimeEvent('candidate:assigned', {
            positionId,
            positionTitle: position.title,
            count: inserted.length,
            assignedBy: user.name || 'User',
        })

        return NextResponse.json({
            message: `${inserted.length} candidate(s) assigned to "${position.title}"`,
            assigned: inserted.length,
            skipped,
            positionTitle: position.title,
        }, { status: 201 })
    } catch (error) {
        console.error('Bulk assign error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
