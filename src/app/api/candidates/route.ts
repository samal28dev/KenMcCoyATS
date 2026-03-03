import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Candidate from '../../../models/Candidate'
import { verifyAuth } from '../../../lib/auth'
import { getUserScope } from '../../../lib/role-scope'
import { emitRealtimeEvent } from '@/lib/socket'
import { logActivity } from '@/lib/activity-feed'
import { writeAuditLog } from '@/lib/audit-log'

// GET /api/candidates — list with pagination, filters, search
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const positionId = searchParams.get('positionId')
        const clientId = searchParams.get('clientId')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')

        const filter: any = {}
        if (status) filter.status = status
        if (positionId) filter.positionId = positionId
        if (clientId) filter.clientId = clientId
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } },
            ]
        }

        // Apply role-based scoping
        const scope = await getUserScope(user._id.toString(), user.role, 'assignedTo')
        Object.assign(filter, scope.filter)

        const total = await Candidate.countDocuments(filter)
        const candidates = await Candidate.find(filter)
            .populate('assignedTo', 'name email role')
            .populate('positionId', 'title')
            .populate('clientId', 'companyName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()

        return NextResponse.json({
            candidates,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        })
    } catch (error) {
        console.error('Candidates list error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/candidates
export async function POST(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
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
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                age--
            }
            body.age = age
        }

        // Check for duplicates by email or phone
        const existing = await Candidate.findOne({
            $or: [
                { email: body.email },
                ...(body.phone ? [{ phone: body.phone }] : []),
            ],
        })

        if (existing) {
            // Duplicate parsing: if older than 30 days, allow overwrite
            const daysSince = (Date.now() - new Date(existing.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
            if (daysSince > 30) {
                // Overwrite old candidate with new data
                const updated = await Candidate.findByIdAndUpdate(existing._id, {
                    ...body,
                    lastParsedBy: user._id,
                    lastParsedAt: new Date(),
                }, { new: true })
                emitRealtimeEvent('candidate:updated', { candidateId: existing._id.toString(), action: 'overwritten' })
                return NextResponse.json({
                    message: 'Duplicate candidate updated (older than 30 days)',
                    candidate: updated,
                    overwritten: true,
                })
            }

            return NextResponse.json({
                message: 'Duplicate candidate found',
                duplicate: { _id: existing._id, name: existing.name, email: existing.email }
            }, { status: 409 })
        }

        const candidate = await Candidate.create({
            ...body,
            assignedTo: body.assignedTo || user._id,
            createdBy: user._id,
            lastParsedBy: body.resumeFile ? user._id : undefined,
            lastParsedAt: body.resumeFile ? new Date() : undefined,
        })

        emitRealtimeEvent('candidate:created', {
            candidateId: candidate._id.toString(),
            candidateName: candidate.name,
            actorId: user._id.toString(),
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'candidate_added',
            targetType: 'candidate',
            targetId: candidate._id.toString(),
            targetName: candidate.name,
        })

        await writeAuditLog({
            action: 'create',
            entityType: 'candidate',
            entityId: candidate._id.toString(),
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { name: candidate.name, email: candidate.email },
        })

        return NextResponse.json(candidate, { status: 201 })
    } catch (error: any) {
        console.error('Candidate create error:', error)
        return NextResponse.json({ message: error.message || 'Failed to create candidate' }, { status: 500 })
    }
}
