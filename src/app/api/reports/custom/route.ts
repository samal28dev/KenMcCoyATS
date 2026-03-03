import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Client from '@/models/Client'
import Candidate from '@/models/Candidate'
import Position from '@/models/Position'
import CandidatePosition from '@/models/CandidatePosition'

/**
 * Customized Report Generator
 * POST: Upload an Excel template → system reads headers → generates report matching those columns
 * GET:  Returns available fields that can be used in templates
 */

// All available fields the system can populate
const FIELD_MAP: Record<string, { source: string; label: string; path: string }> = {
    // Candidate fields
    'name': { source: 'candidate', label: 'Name', path: 'name' },
    'candidate name': { source: 'candidate', label: 'Candidate Name', path: 'name' },
    'email': { source: 'candidate', label: 'Email', path: 'email' },
    'email id': { source: 'candidate', label: 'Email', path: 'email' },
    'phone': { source: 'candidate', label: 'Phone', path: 'phone' },
    'mobile': { source: 'candidate', label: 'Mobile', path: 'phone' },
    'mobile number': { source: 'candidate', label: 'Mobile Number', path: 'phone' },
    'alt phone': { source: 'candidate', label: 'Alt Phone', path: 'alternativeMobile' },
    'alternative mobile': { source: 'candidate', label: 'Alt Mobile', path: 'alternativeMobile' },
    'designation': { source: 'candidate', label: 'Designation', path: 'designation' },
    'current company': { source: 'candidate', label: 'Current Company', path: 'currentCompany' },
    'company': { source: 'candidate', label: 'Company', path: 'currentCompany' },
    'organization': { source: 'candidate', label: 'Organization', path: 'currentCompany' },
    'location': { source: 'candidate', label: 'Location', path: 'location' },
    'current location': { source: 'candidate', label: 'Current Location', path: 'location' },
    'experience': { source: 'candidate', label: 'Experience', path: 'experience' },
    'total experience': { source: 'candidate', label: 'Total Experience', path: 'experience' },
    'ctc': { source: 'candidate', label: 'CTC', path: 'ctc' },
    'salary': { source: 'candidate', label: 'Salary', path: 'ctc' },
    'notice period': { source: 'candidate', label: 'Notice Period', path: 'noticePeriod' },
    'dob': { source: 'candidate', label: 'DOB', path: 'dob' },
    'date of birth': { source: 'candidate', label: 'Date of Birth', path: 'dob' },
    'age': { source: 'candidate', label: 'Age', path: 'age' },
    'qualification': { source: 'candidate', label: 'Qualification', path: 'qualifications' },
    'qualifications': { source: 'candidate', label: 'Qualifications', path: 'qualifications' },
    'skills': { source: 'candidate', label: 'Skills', path: 'skills' },
    'status': { source: 'candidate', label: 'Status', path: 'status' },
    'applied date': { source: 'candidate', label: 'Applied Date', path: 'appliedDate' },
    'created at': { source: 'candidate', label: 'Created At', path: 'createdAt' },
    // Pipeline fields
    'interview status': { source: 'pipeline', label: 'Interview Status', path: 'status' },
    'pipeline status': { source: 'pipeline', label: 'Pipeline Status', path: 'status' },
    'remark': { source: 'pipeline', label: 'Remark', path: 'remarks' },
    'remarks': { source: 'pipeline', label: 'Remarks', path: 'remarks' },
    'feedback': { source: 'pipeline', label: 'Feedback', path: 'remarks' },
    'joining date': { source: 'pipeline', label: 'Joining Date', path: 'joiningDate' },
    'joining location': { source: 'pipeline', label: 'Joining Location', path: 'joiningLocation' },
    // Position fields
    'position': { source: 'position', label: 'Position', path: 'title' },
    'position name': { source: 'position', label: 'Position Name', path: 'title' },
    'position status': { source: 'position', label: 'Position Status', path: 'status' },
    // Client fields
    'client': { source: 'client', label: 'Client', path: 'companyName' },
    'client name': { source: 'client', label: 'Client Name', path: 'companyName' },
    'company name': { source: 'client', label: 'Company Name', path: 'companyName' },
    'gstin': { source: 'client', label: 'GSTIN', path: 'gstin' },
    'city': { source: 'client', label: 'City', path: 'address.city' },
    'state': { source: 'client', label: 'State', path: 'address.state' },
    'country': { source: 'client', label: 'Country', path: 'address.country' },
    'location type': { source: 'client', label: 'Location Type', path: 'locationType' },
    // User fields
    'recruiter': { source: 'user', label: 'Recruiter', path: 'assignedTo.name' },
    'recruiter name': { source: 'user', label: 'Recruiter Name', path: 'assignedTo.name' },
    'assigned to': { source: 'user', label: 'Assigned To', path: 'assignedTo.name' },
}

// GET: Return available fields for template creation
export async function GET() {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Group fields by source
        const fields: Record<string, string[]> = {
            candidate: [],
            pipeline: [],
            position: [],
            client: [],
            user: [],
        }
        const seen = new Set<string>()
        for (const [key, val] of Object.entries(FIELD_MAP)) {
            const labelKey = `${val.source}:${val.path}`
            if (!seen.has(labelKey)) {
                seen.add(labelKey)
                fields[val.source].push(val.label)
            }
        }

        return NextResponse.json({
            fields,
            instructions: 'Create an Excel file with column headers matching these field names. Upload it via POST to generate a report with those columns populated.',
        })
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST: Upload template Excel → generate report
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const formData = await request.formData()
        const file = formData.get('file') as File
        const clientId = formData.get('clientId') as string
        const positionId = formData.get('positionId') as string

        if (!file) {
            return NextResponse.json({ error: 'No template file provided' }, { status: 400 })
        }

        // Read template headers
        const ExcelJS = require('exceljs')
        const workbook = new ExcelJS.Workbook()
        const buffer = Buffer.from(await file.arrayBuffer())
        await workbook.xlsx.load(buffer)

        const templateSheet = workbook.getWorksheet(1)
        if (!templateSheet) {
            return NextResponse.json({ error: 'Template has no worksheets' }, { status: 400 })
        }

        // Extract headers from row 1
        const headers: string[] = []
        const headerRow = templateSheet.getRow(1)
        headerRow.eachCell((cell: any) => {
            if (cell.value) {
                headers.push(String(cell.value).trim())
            }
        })

        if (headers.length === 0) {
            return NextResponse.json({ error: 'No column headers found in template row 1' }, { status: 400 })
        }

        // Match headers to field map
        const columns = headers.map(h => {
            const key = h.toLowerCase().trim()
            const mapped = FIELD_MAP[key]
            return { header: h, mapped: mapped || null }
        })

        const unmapped = columns.filter(c => !c.mapped).map(c => c.header)

        // Determine which data sources we need
        const needsSources = new Set(columns.filter(c => c.mapped).map(c => c.mapped!.source))

        // Fetch data
        const filter: any = {}
        if (clientId) filter.clientId = clientId
        if (positionId) filter.positionId = positionId

        const candidates = await Candidate.find(filter)
            .populate('positionId', 'title status')
            .populate('clientId', 'companyName gstin address locationType')
            .populate('assignedTo', 'name role')
            .lean()

        // Get pipeline data
        const candidateIds = candidates.map((c: any) => c._id)
        const cpRecords = await CandidatePosition.find({ candidateId: { $in: candidateIds } })
            .populate('positionId', 'title status')
            .populate('clientId', 'companyName')
            .lean()
        const cpMap = new Map()
        for (const cp of cpRecords as any[]) {
            cpMap.set(cp.candidateId.toString(), cp)
        }

        // Generate output workbook
        const outputWorkbook = new ExcelJS.Workbook()
        outputWorkbook.creator = 'Ken McCoy Consulting ATS'
        outputWorkbook.created = new Date()
        const ws = outputWorkbook.addWorksheet('Custom Report')

        // Set columns
        ws.columns = columns.map((c, i) => ({
            header: c.header,
            key: `col_${i}`,
            width: 20,
        }))

        // Style header
        const hRow = ws.getRow(1)
        hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } }
        hRow.alignment = { vertical: 'middle', horizontal: 'center' }
        hRow.height = 24

        // Helper to get nested value
        function getNestedValue(obj: any, path: string): any {
            return path.split('.').reduce((o, k) => o?.[k], obj)
        }

        // Populate rows
        for (const candidate of candidates as any[]) {
            const cp = cpMap.get(candidate._id.toString()) as any
            const row: Record<string, any> = {}

            for (let i = 0; i < columns.length; i++) {
                const col = columns[i]
                if (!col.mapped) {
                    row[`col_${i}`] = ''
                    continue
                }

                let value: any = ''
                switch (col.mapped.source) {
                    case 'candidate':
                        value = getNestedValue(candidate, col.mapped.path)
                        break
                    case 'pipeline':
                        value = cp ? getNestedValue(cp, col.mapped.path) : ''
                        break
                    case 'position':
                        value = getNestedValue(candidate.positionId || cp?.positionId, col.mapped.path)
                        break
                    case 'client':
                        value = getNestedValue(candidate.clientId || cp?.clientId, col.mapped.path)
                        break
                    case 'user':
                        value = getNestedValue(candidate, col.mapped.path)
                        break
                }

                // Format special types
                if (value instanceof Date) {
                    value = value.toLocaleDateString()
                } else if (Array.isArray(value)) {
                    value = value.join(', ')
                } else if (col.mapped.path === 'status' && typeof value === 'string') {
                    value = value.replace(/_/g, ' ')
                }

                row[`col_${i}`] = value ?? ''
            }

            ws.addRow(row)
        }

        // Generate Excel buffer
        const outputBuffer = await outputWorkbook.xlsx.writeBuffer()

        return new NextResponse(outputBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="custom_report_${Date.now()}.xlsx"`,
                'X-Unmapped-Columns': unmapped.join(', ') || 'none',
            },
        })
    } catch (error) {
        console.error('Custom report error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
