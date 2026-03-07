import { type NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { verifyAuth } from '@/lib/auth'
import { getUserScope } from '@/lib/role-scope'
import dbConnect from '@/lib/db'
import Client from '@/models/Client'
import Candidate from '@/models/Candidate'
import Position from '@/models/Position'
import CandidatePosition from '@/models/CandidatePosition'
import Billing from '@/models/Billing'
import User from '@/models/User'

// GET /api/reports/export?type=...&format=xlsx
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') || 'candidate'

        // Role-based restriction: master report only for ops_head / admin
        if (type === 'master' && !['super_admin', 'operations_head', 'admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Master report restricted to Operations Head and Admin' }, { status: 403 })
        }

        const ExcelJS = require('exceljs')
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'Ken McCoy Consulting ATS'
        workbook.created = new Date()

        // Extract date range params
        const fromDate = searchParams.get('from')
        const toDate = searchParams.get('toDate') || searchParams.get('to') // Support both 'to' and 'toDate'

        let dateFilter: any = null
        if (fromDate || toDate) {
            dateFilter = {}
            if (fromDate) dateFilter.$gte = new Date(fromDate)
            if (toDate) {
                const end = new Date(toDate)
                end.setHours(23, 59, 59, 999) // Make inclusive of the end date
                dateFilter.$lte = end
            }
        }

        const scope = await getUserScope(user._id.toString(), user.role, 'assignedTo')

        switch (type) {
            case 'clientDetails': {
                const ws = workbook.addWorksheet('Client Details')
                ws.columns = [
                    { header: 'Company Name', key: 'companyName', width: 30 },
                    { header: 'GSTIN', key: 'gstin', width: 20 },
                    { header: 'City', key: 'city', width: 15 },
                    { header: 'State', key: 'state', width: 15 },
                    { header: 'Country', key: 'country', width: 15 },
                    { header: 'Location Type', key: 'locationType', width: 12 },
                    { header: 'Assigned To', key: 'assignedTo', width: 20 },
                    { header: 'Agreement Date', key: 'agreementDate', width: 15 },
                    { header: 'Valid Till', key: 'validTill', width: 15 },
                    { header: 'Status', key: 'status', width: 10 },
                    { header: 'Contact Name', key: 'contactName', width: 20 },
                    { header: 'Contact Email', key: 'contactEmail', width: 25 },
                    { header: 'Contact Phone', key: 'contactPhone', width: 15 },
                ]
                styleHeaderRow(ws)

                const filter = { ...scope.filter }
                if (dateFilter) filter.createdAt = dateFilter

                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const clients = await Client.find(filter).populate('assignedTo', 'name').lean()
                for (const c of clients as any[]) {
                    ws.addRow({
                        companyName: c.companyName,
                        gstin: c.gstin,
                        city: c.address?.city || '',
                        state: c.address?.state || '',
                        country: c.address?.country || '',
                        locationType: c.locationType,
                        assignedTo: c.assignedTo?.name || '',
                        agreementDate: c.agreementDate ? new Date(c.agreementDate).toLocaleDateString() : '',
                        validTill: c.agreementValidTill ? new Date(c.agreementValidTill).toLocaleDateString() : '',
                        status: c.status,
                        contactName: c.contacts?.[0]?.name || '',
                        contactEmail: c.contacts?.[0]?.email || '',
                        contactPhone: c.contacts?.[0]?.mobile || '',
                    })
                }
                break
            }

            case 'candidate': {
                const ws = workbook.addWorksheet('Candidate Report')
                ws.columns = [
                    { header: 'Name', key: 'name', width: 25 },
                    { header: 'Current Company', key: 'company', width: 25 },
                    { header: 'Designation', key: 'designation', width: 20 },
                    { header: 'Mobile', key: 'phone', width: 15 },
                    { header: 'Email', key: 'email', width: 25 },
                    { header: 'Location', key: 'location', width: 15 },
                    { header: 'Interview Status', key: 'interviewStatus', width: 15 },
                    { header: 'Remark/Feedback', key: 'remarks', width: 30 },
                    { header: 'Position', key: 'position', width: 25 },
                    { header: 'Client', key: 'client', width: 25 },
                    { header: 'Recruiter', key: 'recruiter', width: 20 },
                ]
                styleHeaderRow(ws)

                const filter: any = { ...scope.filter }
                const positionId = searchParams.get('positionId')
                const clientId = searchParams.get('clientId')
                if (positionId) filter.positionId = positionId
                if (clientId) filter.clientId = clientId
                if (dateFilter) filter.createdAt = dateFilter

                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const candidates = await Candidate.find(filter)
                    .populate('positionId', 'title')
                    .populate('clientId', 'companyName')
                    .populate('assignedTo', 'name')
                    .lean()

                // Get pipeline statuses
                const candidateIds = (candidates as any[]).map(c => c._id)
                const cpRecords = await CandidatePosition.find({ candidateId: { $in: candidateIds } })
                    .populate('positionId', 'title')
                    .populate('clientId', 'companyName')
                    .lean()
                const cpMap = new Map()
                for (const cp of cpRecords as any[]) {
                    cpMap.set(cp.candidateId.toString(), cp)
                }

                for (const c of candidates as any[]) {
                    const latestCp = cpMap.get(c._id.toString()) as any
                    ws.addRow({
                        name: c.name,
                        company: c.currentCompany || '',
                        designation: c.designation || '',
                        phone: c.phone || '',
                        email: c.email,
                        location: c.location || '',
                        interviewStatus: latestCp?.status?.replace(/_/g, ' ') || c.status || '',
                        remarks: latestCp?.remarks || '',
                        position: c.positionId?.title || latestCp?.positionId?.title || '',
                        client: c.clientId?.companyName || latestCp?.clientId?.companyName || '',
                        recruiter: c.assignedTo?.name || '',
                    })
                }
                break
            }

            case 'joiningOffer': {
                const ws = workbook.addWorksheet('Joining & Offer Report')
                ws.columns = [
                    { header: 'Client', key: 'client', width: 25 },
                    { header: 'Position', key: 'position', width: 25 },
                    { header: 'Candidate', key: 'name', width: 25 },
                    { header: 'Company', key: 'company', width: 20 },
                    { header: 'Designation', key: 'designation', width: 20 },
                    { header: 'Mobile', key: 'phone', width: 15 },
                    { header: 'Email', key: 'email', width: 25 },
                    { header: 'Location', key: 'location', width: 15 },
                    { header: 'Joining Location', key: 'joiningLocation', width: 15 },
                    { header: 'Status', key: 'status', width: 12 },
                    { header: 'Joining Date', key: 'joiningDate', width: 15 },
                    { header: 'Remarks', key: 'remarks', width: 30 },
                    { header: 'Recruiter', key: 'recruiter', width: 20 },
                    { header: 'Recruiter Name', key: 'recruiterName', width: 20 },
                    { header: 'TL Name', key: 'tlName', width: 20 },
                ]
                styleHeaderRow(ws)

                const filter: any = { status: { $in: ['offered', 'joined'] } }
                if (dateFilter) filter.createdAt = dateFilter

                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const pipeline = await CandidatePosition.find(filter)
                    .populate('candidateId', 'name email phone currentCompany designation location assignedTo')
                    .populate('positionId', 'title')
                    .populate('clientId', 'companyName')
                    .populate('createdBy', 'name')
                    .lean()

                // Collect all candidate assignedTo IDs to look up recruiter + TL names
                const recruiterIds = new Set<string>()
                for (const cp of pipeline as any[]) {
                    if (cp.candidateId?.assignedTo) {
                        recruiterIds.add(cp.candidateId.assignedTo.toString())
                    }
                }

                // Fetch recruiters with their managerId (TL)
                const recruiters = recruiterIds.size > 0
                    ? await User.find({ _id: { $in: Array.from(recruiterIds) } })
                        .select('name managerId')
                        .lean() as any[]
                    : []
                const recruiterMap = new Map(recruiters.map((r: any) => [r._id.toString(), r]))

                // Fetch TLs (managers of recruiters)
                const tlIds = new Set<string>()
                for (const r of recruiters) {
                    if (r.managerId) tlIds.add(r.managerId.toString())
                }
                const tls = tlIds.size > 0
                    ? await User.find({ _id: { $in: Array.from(tlIds) } })
                        .select('name')
                        .lean() as any[]
                    : []
                const tlMap = new Map(tls.map((t: any) => [t._id.toString(), t.name]))

                for (const cp of pipeline as any[]) {
                    const assignedToId = cp.candidateId?.assignedTo?.toString()
                    const recruiter = assignedToId ? recruiterMap.get(assignedToId) : null
                    const tlName = recruiter?.managerId ? tlMap.get(recruiter.managerId.toString()) : ''

                    ws.addRow({
                        client: cp.clientId?.companyName || '',
                        position: cp.positionId?.title || '',
                        name: cp.candidateId?.name || '',
                        company: cp.candidateId?.currentCompany || '',
                        designation: cp.candidateId?.designation || '',
                        phone: cp.candidateId?.phone || '',
                        email: cp.candidateId?.email || '',
                        location: cp.candidateId?.location || '',
                        joiningLocation: cp.joiningLocation || '',
                        status: cp.status,
                        joiningDate: cp.joiningDate ? new Date(cp.joiningDate).toLocaleDateString() : '',
                        remarks: cp.remarks || '',
                        recruiter: cp.createdBy?.name || '',
                        recruiterName: recruiter?.name || '',
                        tlName: tlName || '',
                    })
                }
                break
            }

            case 'positionClient': {
                const ws = workbook.addWorksheet('Position Client-wise Report')
                ws.columns = [
                    { header: 'Client Name', key: 'client', width: 25 },
                    { header: 'Position Name', key: 'position', width: 25 },
                    { header: 'Candidate', key: 'candidateName', width: 25 },
                    { header: 'Current Company', key: 'company', width: 20 },
                    { header: 'Designation', key: 'designation', width: 20 },
                    { header: 'Mobile', key: 'phone', width: 15 },
                    { header: 'Email', key: 'email', width: 25 },
                    { header: 'Location', key: 'location', width: 15 },
                    { header: 'Interview Status', key: 'interviewStatus', width: 15 },
                    { header: 'Remarks/Feedback', key: 'remarks', width: 30 },
                ]
                styleHeaderRow(ws)

                const pcClientId = searchParams.get('clientId')
                const posFilter: any = {}
                if (pcClientId) posFilter.clientId = pcClientId
                if (dateFilter) posFilter.createdAt = dateFilter

                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const positions = await Position.find(posFilter)
                    .populate('clientId', 'companyName')
                    .lean()

                for (const p of positions as any[]) {
                    const cps = await CandidatePosition.find({ positionId: p._id })
                        .populate('candidateId', 'name email phone currentCompany designation location')
                        .lean()

                    if (cps.length === 0) {
                        ws.addRow({
                            client: p.clientId?.companyName || '',
                            position: p.title,
                            candidateName: '', company: '', designation: '', phone: '', email: '', location: '',
                            interviewStatus: '', remarks: '',
                        })
                    } else {
                        for (const cp of cps as any[]) {
                            ws.addRow({
                                client: p.clientId?.companyName || '',
                                position: p.title,
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
                break
            }

            case 'generalClient': {
                const ws = workbook.addWorksheet('General Client Report')
                ws.columns = [
                    { header: 'Client Name', key: 'name', width: 30 },
                    { header: 'Positions (Total)', key: 'positions', width: 15 },
                    { header: 'CV Sourced (Total)', key: 'cvCount', width: 15 },
                    { header: 'Status', key: 'status', width: 12 },
                ]
                styleHeaderRow(ws)

                const filter = { ...scope.filter }
                if (dateFilter) filter.createdAt = dateFilter

                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const clients = await Client.find(filter).lean()
                for (const c of clients as any[]) {
                    const posCount = await Position.countDocuments({ clientId: c._id })
                    const cvCount = await CandidatePosition.countDocuments({ clientId: c._id })
                    ws.addRow({
                        name: c.companyName,
                        positions: posCount,
                        cvCount,
                        status: c.status,
                    })
                }
                break
            }

            case 'master': {
                const ws = workbook.addWorksheet('Master Report')
                ws.columns = [
                    { header: 'Client Name', key: 'client', width: 30 },
                    { header: 'Positions (Total)', key: 'positions', width: 15 },
                    { header: 'CV Sourced', key: 'cvCount', width: 15 },
                    { header: 'Positions Closed', key: 'closed', width: 15 },
                    { header: 'Joined', key: 'joined', width: 12 },
                    { header: 'Total Billing', key: 'billing', width: 15 },
                    { header: 'Period', key: 'period', width: 20 },
                ]
                styleHeaderRow(ws)
                ws.insertRow(1, [`Report Generated On: ${new Date().toLocaleString()}`])
                ws.mergeCells(1, 1, 1, 5)
                ws.getRow(1).font = { italic: true, size: 10 }

                const mPeriod = searchParams.get('period') || 'monthly'
                const mYear = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
                const mMonth = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
                const mQuarter = parseInt(searchParams.get('quarter') || (Math.ceil((new Date().getMonth() + 1) / 3)).toString())

                let mStart: Date, mEnd: Date
                if (fromDate && toDate) {
                    mStart = new Date(fromDate)
                    mEnd = new Date(toDate)
                    mEnd.setHours(23, 59, 59, 999)
                } else if (mPeriod === 'monthly') {
                    mStart = new Date(mYear, mMonth - 1, 1)
                    mEnd = new Date(mYear, mMonth, 1)
                } else if (mPeriod === 'quarterly') {
                    mStart = new Date(mYear, (mQuarter - 1) * 3, 1)
                    mEnd = new Date(mYear, mQuarter * 3, 1)
                } else {
                    mStart = new Date(mYear, 0, 1)
                    mEnd = new Date(mYear + 1, 0, 1)
                }

                const periodLabel = fromDate && toDate
                    ? `${fromDate} to ${toDate}`
                    : mPeriod === 'monthly' ? `${mMonth}/${mYear}`
                        : mPeriod === 'quarterly' ? `Q${mQuarter}/${mYear}`
                            : `${mYear}`

                const clients = await Client.find({}).lean()
                for (const c of clients as any[]) {
                    const posFilter: any = { clientId: c._id, createdAt: { $gte: mStart, $lt: mEnd } }
                    const posCount = await Position.countDocuments(posFilter)
                    const closedCount = await Position.countDocuments({ ...posFilter, status: 'closed' })
                    const cvCount = await CandidatePosition.countDocuments({ clientId: c._id, createdAt: { $gte: mStart, $lt: mEnd } })
                    const joinedCount = await CandidatePosition.countDocuments({ clientId: c._id, status: 'joined', createdAt: { $gte: mStart, $lt: mEnd } })

                    // Sum billing amount for this client in the period
                    const billingAgg = await Billing.aggregate([
                        { $match: { clientId: c._id, invoiceDate: { $gte: mStart, $lt: mEnd }, status: { $ne: 'cancelled' } } },
                        { $group: { _id: null, total: { $sum: '$amount' } } },
                    ])
                    const totalBilling = billingAgg.length > 0 ? billingAgg[0].total : 0

                    ws.addRow({
                        client: (c as any).companyName,
                        positions: posCount,
                        cvCount,
                        closed: closedCount,
                        joined: joinedCount,
                        billing: totalBilling ? `₹${totalBilling.toLocaleString('en-IN')}` : '',
                        period: periodLabel,
                    })
                }
                break
            }

            default:
                return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
        }

        // Generate Excel buffer
        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${type}_report_${Date.now()}.xlsx"`,
            },
        })
    } catch (error) {
        console.error('Report export error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function styleHeaderRow(ws: any) {
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 24
}
