import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Interview from '@/models/Interview'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyHierarchy } from '@/lib/notify'

// GET /api/interviews — list with filters
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const candidateId = searchParams.get('candidateId')
        const positionId = searchParams.get('positionId')
        const status = searchParams.get('status')
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        const filter: any = {}
        if (candidateId) filter.candidateId = candidateId
        if (positionId) filter.positionId = positionId
        if (status) filter.status = status
        if (from || to) {
            filter.date = {}
            if (from) filter.date.$gte = new Date(from)
            if (to) filter.date.$lte = new Date(to)
        }

        const interviews = await Interview.find(filter)
            .populate('candidateId', 'name email phone')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .sort({ date: 1, time: 1 })
            .lean()

        return NextResponse.json(interviews)
    } catch (error) {
        console.error('Interviews list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/interviews — schedule a new interview
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()

        const { candidateId, positionId, clientId, type, date, time, interviewers, location, duration } = body

        if (!candidateId || !type || !date || !time) {
            return NextResponse.json(
                { error: 'candidateId, type, date, and time are required' },
                { status: 400 }
            )
        }

        const interview = await Interview.create({
            candidateId,
            positionId: positionId || undefined,
            clientId: clientId || undefined,
            type,
            date: new Date(date),
            time,
            duration: duration || '60 min',
            interviewers: interviewers || [],
            location: location || '',
            status: 'scheduled',
        })

        const populated = await Interview.findById(interview._id)
            .populate('candidateId', 'name email phone')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .lean()

        emitRealtimeEvent('interview:created', {
            interviewId: interview._id.toString(),
            candidateId,
            type,
            date,
            actorId: user._id.toString(),
        })

        // Notify hierarchy about scheduled interview
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: user.name || 'Team Member',
            action: 'status_change',
            entityType: 'candidate',
            entityId: candidateId,
            entityName: (populated as any)?.candidateId?.name || 'Candidate',
            message: `${type} interview scheduled for "${(populated as any)?.candidateId?.name}" on ${new Date(date).toLocaleDateString()}`,
        })

        return NextResponse.json(populated, { status: 201 })
    } catch (error) {
        console.error('Interview create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
