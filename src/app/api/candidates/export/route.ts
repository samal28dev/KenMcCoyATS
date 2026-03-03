import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Candidate from '@/models/Candidate'

/**
 * POST /api/candidates/export — export selected candidates as CSV.
 * Body: { ids?: string[], status?: string, all?: boolean }
 * If ids provided, exports those; if all=true, exports all (with optional status filter).
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { ids, status, all } = body

        let filter: any = {}
        if (ids && Array.isArray(ids) && ids.length > 0) {
            filter._id = { $in: ids }
        } else if (!all) {
            return NextResponse.json({ error: 'Provide ids array or set all: true' }, { status: 400 })
        }
        if (status) filter.status = status

        const candidates = await Candidate.find(filter)
            .select('name email phone countryCode alternativeMobile alternativeCountryCode designation currentCompany location experience ctc noticePeriod dob qualifications skills status createdAt')
            .sort({ createdAt: -1 })
            .lean()

        if (candidates.length === 0) {
            return NextResponse.json({ error: 'No candidates found to export' }, { status: 404 })
        }

        // Build CSV
        const headers = [
            'Name', 'Email', 'Phone', 'Country Code', 'Alt. Mobile', 'Alt. Country Code',
            'Designation', 'Current Company', 'Location', 'Experience (yrs)',
            'CTC (INR)', 'Notice Period (days)', 'DOB', 'Qualifications',
            'Skills', 'Status', 'Created At',
        ]

        const escapeCSV = (val: any) => {
            if (val === null || val === undefined) return ''
            const str = String(val)
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`
            }
            return str
        }

        const rows = candidates.map((c: any) => [
            escapeCSV(c.name),
            escapeCSV(c.email),
            escapeCSV(c.phone),
            escapeCSV(c.countryCode || '+91'),
            escapeCSV(c.alternativeMobile),
            escapeCSV(c.alternativeCountryCode),
            escapeCSV(c.designation),
            escapeCSV(c.currentCompany),
            escapeCSV(c.location),
            escapeCSV(c.experience),
            escapeCSV(c.ctc),
            escapeCSV(c.noticePeriod),
            escapeCSV(c.dob ? new Date(c.dob).toLocaleDateString('en-IN') : ''),
            escapeCSV(Array.isArray(c.qualifications) ? c.qualifications.join('; ') : c.qualifications),
            escapeCSV(Array.isArray(c.skills) ? c.skills.join('; ') : c.skills),
            escapeCSV(c.status),
            escapeCSV(c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : ''),
        ].join(','))

        const csv = [headers.join(','), ...rows].join('\n')

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="candidates-export-${new Date().toISOString().split('T')[0]}.csv"`,
            },
        })
    } catch (error) {
        console.error('Candidates export error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
