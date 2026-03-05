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
        const minExp = searchParams.get('minExp')
        const maxExp = searchParams.get('maxExp')
        const location = searchParams.get('location')
        const minCTC = searchParams.get('minCTC')
        const maxCTC = searchParams.get('maxCTC')
        const maxNotice = searchParams.get('maxNotice')
        const skills = searchParams.get('skills')
        const designation = searchParams.get('designation')
        const company = searchParams.get('company')
        const ugQual = searchParams.get('ugQual')   // 'Any UG qualification' | 'Specific UG qualification' | 'No UG qualification'
        const pgQual = searchParams.get('pgQual')   // 'Any PG qualification' | 'Specific PG qualification' | 'No PG qualification'
        const ugSpecific = searchParams.get('ugSpecific') // free text e.g. 'B.Tech'
        const pgSpecific = searchParams.get('pgSpecific') // free text e.g. 'MBA'
        const industry = searchParams.get('industry')
        const deptRole = searchParams.get('deptRole')
        const degree = searchParams.get('degree')
        const college = searchParams.get('college')
        const gradYear = searchParams.get('gradYear')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')

        const filter: any = {}
        if (status) filter.status = status
        if (positionId) filter.positionId = positionId
        if (clientId) filter.clientId = clientId
        if (minExp) filter.experience = { ...filter.experience, $gte: Number(minExp) }
        if (maxExp) filter.experience = { ...filter.experience, $lte: Number(maxExp) }
        if (minCTC) filter.ctc = { ...filter.ctc, $gte: Number(minCTC) }
        if (maxCTC) filter.ctc = { ...filter.ctc, $lte: Number(maxCTC) }
        if (maxNotice) filter.noticePeriod = { $lte: Number(maxNotice) }
        if (location) {
            const escapedLoc = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.location = { $regex: escapedLoc, $options: 'i' }
        }
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } },
                { designation: { $regex: escaped, $options: 'i' } },
                { currentCompany: { $regex: escaped, $options: 'i' } },
            ]
        }
        if (skills) {
            const skillList = skills.split(',').map(s => s.trim()).filter(Boolean)
            if (skillList.length > 0) {
                filter.skills = { $all: skillList.map(s => new RegExp(s, 'i')) }
            }
        }
        if (designation) {
            const esc = designation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.designation = { $regex: esc, $options: 'i' }
        }
        if (company) {
            const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.currentCompany = { $regex: esc, $options: 'i' }
        }
        if (industry) {
            const esc = industry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const industryOr = [
                { designation: { $regex: esc, $options: 'i' } },
                { currentCompany: { $regex: esc, $options: 'i' } },
            ]
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: industryOr }]
                delete filter.$or
            } else {
                filter.$or = industryOr
            }
        }
        if (deptRole) {
            const esc = deptRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.designation = { $regex: esc, $options: 'i' }
        }
        if (degree && !filter.qualifications) {
            const esc = degree.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.qualifications = { $elemMatch: { $regex: esc, $options: 'i' } }
        }
        if (college) {
            const esc = college.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$and = [...(filter.$and || []), { education: { $elemMatch: { institution: { $regex: esc, $options: 'i' } } } }]
        }
        if (gradYear) {
            filter.$and = [...(filter.$and || []), { education: { $elemMatch: { endDate: { $regex: gradYear, $options: 'i' } } } }]
        }

        // UG/PG qualification filters — comprehensive regex covering all common spellings:
        // UG: B.Tech, BTech, B.E, BE, BCA, BBA, B.Sc, BSc, B.Com, BCom, B.A, BA, BArch,
        //     Bachelor, Bachelors, Bachelor's, Bachelor of Technology, Undergraduate, etc.
        // PG: M.Tech, MTech, M.E, ME, MBA, MCA, M.Sc, MSc, M.Com, MCom, M.A, MA, MPhil,
        //     Master, Masters, Master's, PhD, Ph.D, Doctorate, PGDM, Post Graduate, etc.
        const UG_REGEX = '^(B[.\\s\\-]|BE\\b|BTech\\b|BCA\\b|BBA\\b|BSc\\b|BCom\\b|BArch\\b|B\\.?A\\.?\\b|Bachelor|Undergraduate)'
        const PG_REGEX = '^(M[.\\s\\-]|ME\\b|MTech\\b|MBA\\b|MCA\\b|MSc\\b|MCom\\b|MPhil\\b|M\\.?A\\.?\\b|Master|Ph\\.?D|Doctorate|PGDM|Post.?Grad)'

        if (ugQual === 'Any UG qualification') {
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: UG_REGEX, $options: 'i' } }
        } else if (ugQual === 'No UG qualification') {
            filter.qualifications = { ...filter.qualifications, $not: { $elemMatch: { $regex: UG_REGEX, $options: 'i' } } }
        } else if (ugQual === 'Specific UG qualification' && ugSpecific) {
            const escUg = ugSpecific.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: escUg, $options: 'i' } }
        } else if (ugQual === 'Specific UG qualification') {
            // selected but no text entered — treat as Any UG
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: UG_REGEX, $options: 'i' } }
        }

        if (pgQual === 'Any PG qualification') {
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: PG_REGEX, $options: 'i' } }
        } else if (pgQual === 'No PG qualification') {
            filter.qualifications = { ...filter.qualifications, $not: { $elemMatch: { $regex: PG_REGEX, $options: 'i' } } }
        } else if (pgQual === 'Specific PG qualification' && pgSpecific) {
            const escPg = pgSpecific.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: escPg, $options: 'i' } }
        } else if (pgQual === 'Specific PG qualification') {
            filter.qualifications = { ...filter.qualifications, $elemMatch: { $regex: PG_REGEX, $options: 'i' } }
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

        // Sanitize dob — AI may return the string "null"
        if (!body.dob || body.dob === 'null' || body.dob === '') {
            delete body.dob
            delete body.age
        } else {
            // Auto-calculate age from DOB
            const dob = new Date(body.dob)
            if (isNaN(dob.getTime())) {
                delete body.dob
                delete body.age
            } else {
                const today = new Date()
                let age = today.getFullYear() - dob.getFullYear()
                const monthDiff = today.getMonth() - dob.getMonth()
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
                body.age = age
            }
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
