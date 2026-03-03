import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { canPerformAction } from '@/lib/role-scope'
import dbConnect from '@/lib/db'
import Client from '@/models/Client'
import Candidate from '@/models/Candidate'
import Position from '@/models/Position'
import { emitRealtimeEvent } from '@/lib/socket'

/**
 * Parse an XLSX file buffer into { headers: string[], rows: string[][] }
 * Uses ExcelJS which is already a project dependency.
 */
async function parseXlsx(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: string[][] }> {
    const ExcelJS = require('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(buffer))

    const worksheet = workbook.worksheets[0]
    if (!worksheet || worksheet.rowCount < 2) {
        throw new Error('XLSX must have a header row and at least one data row')
    }

    const headers: string[] = []
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
        headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase().replace(/['"]/g, '')
    })

    const rows: string[][] = []
    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i)
        const values: string[] = []
        let hasData = false
        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
            const val = cell.value != null ? String(cell.value).trim() : ''
            values[colNumber - 1] = val
            if (val) hasData = true
        })
        if (hasData) rows.push(values)
    }

    return { headers, rows }
}

// POST /api/import — mass upload CSV/XLSX for legacy data
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only ops_head / super_admin can mass import
        if (!canPerformAction(user.role, 'create', 'user')) {
            return NextResponse.json({ error: 'Mass import restricted to Operations Head and Admin' }, { status: 403 })
        }

        await dbConnect()

        const formData = await request.formData()
        const file = formData.get('file') as File
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const isCSV = file.name.endsWith('.csv')
        const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

        if (!isCSV && !isXLSX) {
            return NextResponse.json({ error: 'Please upload a CSV or XLSX file.' }, { status: 400 })
        }

        let headers: string[]
        let rows: string[][]

        if (isXLSX) {
            const buffer = await file.arrayBuffer()
            const parsed = await parseXlsx(buffer)
            headers = parsed.headers
            rows = parsed.rows
        } else {
            // Parse CSV
            const text = await file.text()
            const lines = text.split('\n').map(l => l.trim()).filter(l => l)
            if (lines.length < 2) {
                return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
            }

            headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
            rows = lines.slice(1).map(line => {
                // Handle quoted CSV fields
                const values: string[] = []
                let current = ''
                let inQuotes = false
                for (const char of line) {
                    if (char === '"') { inQuotes = !inQuotes; continue }
                    if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
                    current += char
                }
                values.push(current.trim())
                return values
            })
        }

        // Detect entity type from headers
        const entityType = detectEntityType(headers)
        let imported = 0
        let skipped = 0
        const errors: string[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                const record: any = {}
                headers.forEach((h, idx) => {
                    if (idx < row.length && row[idx]) {
                        record[mapHeader(h)] = row[idx]
                    }
                })

                if (entityType === 'candidate') {
                    // Duplicate check
                    if (record.email) {
                        const existing = await Candidate.findOne({ email: record.email })
                        if (existing) { skipped++; continue }
                    }
                    await Candidate.create({ ...record, createdBy: user._id, status: record.status || 'new' })
                    imported++
                } else if (entityType === 'client') {
                    if (record.companyName) {
                        const existing = await Client.findOne({ companyName: record.companyName })
                        if (existing) { skipped++; continue }
                    }
                    await Client.create({ ...record, createdBy: user._id, status: record.status || 'active' })
                    imported++
                } else if (entityType === 'position') {
                    await Position.create({ ...record, createdBy: user._id, status: record.status || 'new' })
                    imported++
                }
            } catch (err: any) {
                errors.push(`Row ${i + 2}: ${err.message}`)
            }
        }

        // Broadcast import completion so other clients refresh
        if (imported > 0) {
            emitRealtimeEvent('import:completed', {
                entityType,
                imported,
                actorId: user._id.toString(),
            })
            emitRealtimeEvent('dashboard:refresh', { reason: 'import' })
        }

        return NextResponse.json({
            success: true,
            entityType,
            imported,
            skipped,
            total: rows.length,
            errors: errors.slice(0, 10),
        })
    } catch (error) {
        console.error('Import error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function detectEntityType(headers: string[]): 'candidate' | 'client' | 'position' {
    const h = headers.join(' ')
    if (h.includes('email') && (h.includes('experience') || h.includes('ctc') || h.includes('designation') || h.includes('qualification'))) {
        return 'candidate'
    }
    if (h.includes('company') && (h.includes('gstin') || h.includes('agreement'))) {
        return 'client'
    }
    if (h.includes('title') && (h.includes('client') || h.includes('jd'))) {
        return 'position'
    }
    // Default to candidate
    return 'candidate'
}

function mapHeader(h: string): string {
    const mapping: Record<string, string> = {
        'name': 'name',
        'candidate name': 'name',
        'full name': 'name',
        'email': 'email',
        'email id': 'email',
        'phone': 'phone',
        'mobile': 'phone',
        'mobile number': 'phone',
        'mobile no': 'phone',
        'experience': 'experience',
        'total experience': 'experience',
        'experience (years)': 'experience',
        'company': 'currentCompany',
        'current company': 'currentCompany',
        'current/last company': 'currentCompany',
        'organization': 'currentCompany',
        'current/last organization': 'currentCompany',
        'designation': 'designation',
        'current designation': 'designation',
        'location': 'location',
        'current location': 'location',
        'city': 'location',
        'ctc': 'ctc',
        'current ctc': 'ctc',
        'notice period': 'noticePeriod',
        'notice': 'noticePeriod',
        'status': 'status',
        'qualification': 'qualifications',
        'education': 'qualifications',
        'skills': 'skills',
        'dob': 'dob',
        'date of birth': 'dob',
        // Client fields
        'company name': 'companyName',
        'gstin': 'gstin',
        'address': 'address.line1',
        'state': 'address.state',
        'pin': 'address.pin',
        'country': 'address.country',
        'agreement date': 'agreementDate',
        'agreement valid till': 'agreementValidTill',
        // Position fields
        'title': 'title',
        'position title': 'title',
        'description': 'description',
    }
    return mapping[h] || h.replace(/\s+/g, '_')
}
