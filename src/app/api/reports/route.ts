import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Client from '../../../models/Client'
import Candidate from '../../../models/Candidate'
import Position from '../../../models/Position'
import CandidatePosition from '../../../models/CandidatePosition'
import { verifyAuth } from '../../../lib/auth'

// GET /api/reports?type=clientDetails|candidate|positionClient|joiningOffer|generalClient|master
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const type = searchParams.get('type')

        switch (type) {
            case 'clientDetails':
                return NextResponse.json(await getClientDetailsReport())
            case 'candidate':
                return NextResponse.json(await getCandidateReport(searchParams))
            case 'positionClient':
                return NextResponse.json(await getPositionClientReport(searchParams))
            case 'joiningOffer':
                return NextResponse.json(await getJoiningOfferReport())
            case 'generalClient':
                return NextResponse.json(await getGeneralClientReport())
            case 'master':
                return NextResponse.json(await getMasterReport(searchParams))
            default:
                return NextResponse.json({ message: 'Invalid report type' }, { status: 400 })
        }
    } catch (error) {
        console.error('Report error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

async function getClientDetailsReport() {
    const clients = await Client.find({})
        .populate('assignedTo', 'name')
        .lean()

    return clients.map((c: any) => ({
        companyName: c.companyName,
        gstin: c.gstin,
        city: c.address?.city || '',
        state: c.address?.state || '',
        country: c.address?.country || '',
        locationType: c.locationType,
        assignedTo: c.assignedTo?.name || '',
        agreementDate: c.agreementDate || '',
        agreementValidTill: c.agreementValidTill || '',
        status: c.status,
        primaryContactName: c.contacts?.[0]?.name || '',
        primaryContactEmail: c.contacts?.[0]?.email || '',
        primaryContactPhone: c.contacts?.[0]?.mobile || '',
    }))
}

async function getCandidateReport(searchParams: URLSearchParams) {
    const filter: any = {}
    const positionId = searchParams.get('positionId')
    const clientId = searchParams.get('clientId')
    const status = searchParams.get('status')
    if (positionId) filter.positionId = positionId
    if (clientId) filter.clientId = clientId
    if (status) filter.status = status

    const candidates = await Candidate.find(filter)
        .populate('positionId', 'title')
        .populate('clientId', 'companyName')
        .populate('assignedTo', 'name role')
        .lean()

    // Also get pipeline status for each candidate
    const candidateIds = candidates.map((c: any) => c._id)
    const cpRecords = await CandidatePosition.find({ candidateId: { $in: candidateIds } })
        .populate('positionId', 'title')
        .populate('clientId', 'companyName')
        .lean()
    const cpMap = new Map()
    for (const cp of cpRecords as any[]) {
        if (!cpMap.has(cp.candidateId.toString())) cpMap.set(cp.candidateId.toString(), [])
        cpMap.get(cp.candidateId.toString()).push(cp)
    }

    return candidates.map((c: any) => {
        const pipelines = cpMap.get(c._id.toString()) || []
        const latestPipeline = pipelines[0]
        return {
            name: c.name,
            email: c.email,
            phone: c.phone || '',
            company: c.currentCompany || '',
            designation: c.designation || '',
            location: c.location || '',
            status: c.status,
            position: c.positionId?.title || latestPipeline?.positionId?.title || '',
            client: c.clientId?.companyName || latestPipeline?.clientId?.companyName || '',
            interviewStatus: latestPipeline?.status?.replace(/_/g, ' ') || '',
            remarks: latestPipeline?.remarks || '',
            recruiter: c.assignedTo?.name || '',
        }
    })
}

async function getPositionClientReport(searchParams: URLSearchParams) {
    const filter: any = {}
    const clientId = searchParams.get('clientId')
    if (clientId) filter.clientId = clientId

    const positions = await Position.find(filter)
        .populate('clientId', 'companyName')
        .populate('assignedTo', 'name')
        .lean()

    const result = []
    for (const p of positions) {
        const pos = p as any
        // Get all candidates for this position
        const cps = await CandidatePosition.find({ positionId: pos._id })
            .populate('candidateId', 'name email phone currentCompany designation location')
            .populate('clientId', 'companyName')
            .lean()

        if (cps.length === 0) {
            // Still show the position even without candidates
            result.push({
                client: pos.clientId?.companyName || '',
                position: pos.title,
                candidateName: '',
                company: '',
                designation: '',
                phone: '',
                email: '',
                location: '',
                interviewStatus: '',
                remarks: '',
            })
        } else {
            for (const cp of cps as any[]) {
                result.push({
                    client: pos.clientId?.companyName || '',
                    position: pos.title,
                    candidateName: cp.candidateId?.name || '',
                    company: cp.candidateId?.currentCompany || '',
                    designation: cp.candidateId?.designation || '',
                    phone: cp.candidateId?.phone || '',
                    email: cp.candidateId?.email || '',
                    location: cp.candidateId?.location || '',
                    interviewStatus: cp.status?.replace(/_/g, ' ') || '',
                    remarks: cp.remarks || '',
                })
            }
        }
    }
    return result
}

async function getJoiningOfferReport() {
    const pipeline = await CandidatePosition.find({
        status: { $in: ['offered', 'joined'] }
    })
        .populate('candidateId', 'name email phone currentCompany designation location')
        .populate('positionId', 'title')
        .populate('clientId', 'companyName')
        .populate('createdBy', 'name')
        .lean()

    return pipeline.map((cp: any) => ({
        candidateName: cp.candidateId?.name || '',
        email: cp.candidateId?.email || '',
        phone: cp.candidateId?.phone || '',
        company: cp.candidateId?.currentCompany || '',
        designation: cp.candidateId?.designation || '',
        location: cp.candidateId?.location || '',
        position: cp.positionId?.title || '',
        client: cp.clientId?.companyName || '',
        status: cp.status,
        joiningDate: cp.joiningDate || '',
        joiningLocation: cp.joiningLocation || '',
        remarks: cp.remarks || '',
        recruiter: cp.createdBy?.name || '',
    }))
}

async function getGeneralClientReport() {
    const clients = await Client.find({}).lean()
    const result = []
    for (const c of clients) {
        const posCount = await Position.countDocuments({ clientId: c._id })
        const cvCount = await CandidatePosition.countDocuments({ clientId: c._id })
        result.push({
            companyName: (c as any).companyName,
            status: (c as any).status,
            positionCount: posCount,
            cvCount,
        })
    }
    return result
}

async function getMasterReport(searchParams: URLSearchParams) {
    const period = searchParams.get('period') || 'monthly'
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const quarter = parseInt(searchParams.get('quarter') || (Math.ceil((new Date().getMonth() + 1) / 3)).toString())

    let startDate: Date, endDate: Date
    if (period === 'monthly') {
        startDate = new Date(year, month - 1, 1)
        endDate = new Date(year, month, 1)
    } else if (period === 'quarterly') {
        startDate = new Date(year, (quarter - 1) * 3, 1)
        endDate = new Date(year, quarter * 3, 1)
    } else {
        startDate = new Date(year, 0, 1)
        endDate = new Date(year + 1, 0, 1)
    }

    const clients = await Client.find({}).lean()
    const result = []
    for (const c of clients as any[]) {
        const posFilter: any = { clientId: c._id, createdAt: { $gte: startDate, $lt: endDate } }
        const posCount = await Position.countDocuments(posFilter)
        const closedCount = await Position.countDocuments({ ...posFilter, status: 'closed' })
        const cvCount = await CandidatePosition.countDocuments({ clientId: c._id, createdAt: { $gte: startDate, $lt: endDate } })
        const joinedCount = await CandidatePosition.countDocuments({ clientId: c._id, status: 'joined', createdAt: { $gte: startDate, $lt: endDate } })

        result.push({
            client: c.companyName,
            positions: posCount,
            cvCount,
            closed: closedCount,
            joined: joinedCount,
            billing: '', // manually filled by ops head
            period: `${period} - ${period === 'monthly' ? `${month}/${year}` : period === 'quarterly' ? `Q${quarter}/${year}` : year}`,
        })
    }
    return result
}
