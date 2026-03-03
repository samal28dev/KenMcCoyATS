import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import CandidatePosition from '@/models/CandidatePosition'
import Candidate from '@/models/Candidate'
import Timeline from '@/models/Timeline'
import { emitRealtimeEvent } from '@/lib/socket'
import { writeAuditLog } from '@/lib/audit-log'

/**
 * POST /api/candidates/bulk-update — bulk status change for candidate-position records.
 * Body: { ids: string[], status: string, remarks?: string }
 * ids = array of CandidatePosition _ids
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { ids, status, remarks } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
        }
        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 })
        }

        const validStatuses = [
            'submitted', 'shortlisted', 'interview_l1', 'interview_l2',
            'interview_l3', 'offered', 'joined', 'rejected', 'on_hold', 'withdrawn',
        ]
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
        }

        if (ids.length > 100) {
            return NextResponse.json({ error: 'Maximum 100 records per bulk update' }, { status: 400 })
        }

        // Fetch all records to be updated (for timeline + audit)
        const records = await CandidatePosition.find({ _id: { $in: ids } })
            .populate('candidateId', 'name')
            .populate('positionId', 'title')
            .lean() as any[]

        if (records.length === 0) {
            return NextResponse.json({ error: 'No matching records found' }, { status: 404 })
        }

        // Bulk update
        const updates: any = { status }
        if (remarks) updates.remarks = remarks

        const result = await CandidatePosition.updateMany(
            { _id: { $in: ids } },
            { $set: updates }
        )

        // Create timeline entries for each
        const timelineEntries = records.map((r: any) => ({
            candidateId: r.candidateId?._id,
            positionId: r.positionId?._id,
            type: 'status_change',
            title: `${r.status?.replace(/_/g, ' ')} → ${status.replace(/_/g, ' ')} (bulk)`,
            description: remarks || `Bulk status change to ${status.replace(/_/g, ' ')}`,
            status: 'completed',
            performedBy: user._id,
            date: new Date(),
            notes: `Bulk update: ${r.status} → ${status}`,
        }))

        try { await Timeline.insertMany(timelineEntries) } catch { /* optional */ }

        // If status is 'joined', also update candidate status
        if (status === 'joined') {
            const candidateIds = records.map((r: any) => r.candidateId?._id).filter(Boolean)
            await Candidate.updateMany({ _id: { $in: candidateIds } }, { status: 'joined' })
        }

        // Audit log
        await writeAuditLog({
            action: 'bulk_status_change',
            entityType: 'candidate_position',
            entityId: ids.join(','),
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { ids, newStatus: status, recordCount: records.length },
        })

        emitRealtimeEvent('dashboard:refresh', { reason: 'bulk_status_change' })

        return NextResponse.json({
            success: true,
            modifiedCount: result.modifiedCount,
            message: `${result.modifiedCount} record(s) updated to "${status}"`,
        })
    } catch (error) {
        console.error('Bulk update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
