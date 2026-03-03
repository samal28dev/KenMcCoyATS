import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { canPerformAction } from '@/lib/role-scope'
import dbConnect from '@/lib/db'
import Candidate from '@/models/Candidate'
import { emitRealtimeEvent } from '@/lib/socket'

// POST /api/candidates/unlock — unlock a candidate from a position
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only admins and ops heads can unlock
        if (!canPerformAction(user.role, 'assign', 'candidate')) {
            return NextResponse.json({ error: 'Insufficient permissions to unlock candidate' }, { status: 403 })
        }

        await dbConnect()
        const body = await request.json()
        const { candidateId } = body

        if (!candidateId) {
            return NextResponse.json({ error: 'candidateId is required' }, { status: 400 })
        }

        const candidate = await Candidate.findByIdAndUpdate(
            candidateId,
            {
                isLocked: false,
                lockedByPosition: null,
                lockedAt: null,
            },
            { new: true }
        ).lean()

        if (!candidate) {
            return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
        }

        emitRealtimeEvent('candidate:updated', {
            candidateId,
            action: 'unlocked',
            actorId: user._id.toString(),
        })

        return NextResponse.json({ success: true, candidate })
    } catch (error) {
        console.error('Candidate unlock error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
