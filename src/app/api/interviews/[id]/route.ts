import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Interview from '@/models/Interview'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'

// GET /api/interviews/[id]
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const interview = await Interview.findById(id)
            .populate('candidateId', 'name email phone')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .lean()

        if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

        return NextResponse.json(interview)
    } catch (error) {
        console.error('Interview get error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/interviews/[id] — update interview (reschedule, complete, add feedback)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params
        const body = await request.json()

        const interview = await Interview.findByIdAndUpdate(id, { $set: body }, { new: true })
            .populate('candidateId', 'name email phone')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .lean() as any

        if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

        emitRealtimeEvent('interview:updated', {
            interviewId: id,
            status: interview.status,
            actorId: user._id.toString(),
        })

        // Notify hierarchy on status changes (completed, cancelled)
        if (body.status && ['completed', 'cancelled', 'no-show'].includes(body.status)) {
            await notifyHierarchy({
                actorId: user._id,
                actorRole: user.role,
                actorName: user.name || 'Team Member',
                action: 'status_change',
                entityType: 'candidate',
                entityId: interview.candidateId?._id?.toString() || '',
                entityName: interview.candidateId?.name || 'Candidate',
                message: `${interview.type} interview for "${interview.candidateId?.name}" marked as ${body.status}${body.recommendation ? ` — ${body.recommendation}` : ''}`,
            })
        }

        return NextResponse.json(interview)
    } catch (error) {
        console.error('Interview update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/interviews/[id] — cancel interview
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const interview = await Interview.findByIdAndUpdate(
            id,
            { status: 'cancelled' },
            { new: true }
        ).lean()

        if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 })

        emitRealtimeEvent('interview:updated', {
            interviewId: id,
            action: 'cancelled',
            actorId: user._id.toString(),
        })

        return NextResponse.json({ success: true, interview })
    } catch (error) {
        console.error('Interview delete error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
