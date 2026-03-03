import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Candidate from '@/models/Candidate'
import FileStore from '@/models/FileStore'
import crypto from 'crypto'
import path from 'path'

/**
 * POST /api/careers/apply — public endpoint (no auth required)
 * Accepts a multi-part form submission from the public careers page.
 * Creates a new Candidate record with status 'new' linked to the position.
 */
export async function POST(request: Request) {
    try {
        await dbConnect()

        const formData = await request.formData()
        const positionId = formData.get('positionId') as string
        const firstName = (formData.get('firstName') as string || '').trim()
        const lastName = (formData.get('lastName') as string || '').trim()
        const email = (formData.get('email') as string || '').trim()
        const phone = (formData.get('phone') as string || '').trim()
        const location = (formData.get('location') as string || '').trim()
        const linkedin = (formData.get('linkedin') as string || '').trim()
        const github = (formData.get('github') as string || '').trim()
        const portfolio = (formData.get('portfolio') as string || '').trim()
        const coverLetter = (formData.get('coverLetter') as string || '').trim()
        const experience = (formData.get('experience') as string || '').trim()
        const expectedSalary = (formData.get('expectedSalary') as string || '').trim()
        const availability = (formData.get('availability') as string || '').trim()
        const referral = (formData.get('referral') as string || '').trim()
        const resumeFile = formData.get('resume') as File | null

        // Validation
        if (!firstName || !lastName || !email) {
            return NextResponse.json(
                { error: 'First name, last name, and email are required' },
                { status: 400 }
            )
        }

        if (!positionId) {
            return NextResponse.json({ error: 'Position ID is required' }, { status: 400 })
        }

        // Check for existing candidate with same email for this position
        const existing = await Candidate.findOne({ email, positionId })
        if (existing) {
            return NextResponse.json(
                { error: 'You have already applied for this position' },
                { status: 409 }
            )
        }

        // Store resume if provided
        let storedResume: { storageId: string; filename: string } | null = null
        if (resumeFile && resumeFile.size > 0) {
            if (resumeFile.size > 5 * 1024 * 1024) {
                return NextResponse.json({ error: 'Resume must be under 5MB' }, { status: 400 })
            }

            const ext = path.extname(resumeFile.name).toLowerCase()
            if (!['.pdf', '.doc', '.docx'].includes(ext)) {
                return NextResponse.json(
                    { error: 'Resume must be a PDF, DOC, or DOCX file' },
                    { status: 400 }
                )
            }

            const buffer = Buffer.from(await resumeFile.arrayBuffer())
            const hash = crypto.randomBytes(8).toString('hex')
            const uniqueFilename = `application_${Date.now()}_${hash}_${resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

            const contentTypeMap: Record<string, string> = {
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }

            const stored = await FileStore.create({
                filename: uniqueFilename,
                originalName: resumeFile.name,
                contentType: contentTypeMap[ext] || 'application/octet-stream',
                size: resumeFile.size,
                data: buffer,
                fileType: 'resume',
                hash: crypto.createHash('md5').update(buffer).digest('hex'),
                entityType: 'candidate',
            })

            storedResume = { storageId: stored._id.toString(), filename: resumeFile.name }
        }

        // Create candidate
        const candidateData: Record<string, unknown> = {
            name: `${firstName} ${lastName}`,
            email,
            phone: phone || undefined,
            location: location || undefined,
            linkedin: linkedin || undefined,
            github: github || undefined,
            portfolio: portfolio || undefined,
            experience: experience || undefined,
            positionId,
            status: 'new',
            source: referral ? `Careers page (${referral})` : 'Careers page',
            lastParsedBy: 'public-application',
        }

        if (storedResume) {
            candidateData.resumeFile = storedResume.storageId
            candidateData.resumeFilename = storedResume.filename
        }

        if (coverLetter) {
            candidateData.notes = coverLetter
        }

        if (expectedSalary) {
            // Try to parse numeric salary
            const numMatch = expectedSalary.replace(/[^0-9.]/g, '')
            if (numMatch) {
                candidateData.ctc = parseFloat(numMatch)
            }
        }

        const candidate = await Candidate.create(candidateData)

        // Link resume file to candidate entity
        if (storedResume) {
            await FileStore.findByIdAndUpdate(storedResume.storageId, {
                entityId: candidate._id,
            })
        }

        return NextResponse.json({
            success: true,
            message: 'Application submitted successfully',
        })
    } catch (error) {
        console.error('Public application error:', error)
        return NextResponse.json(
            { error: 'Failed to submit application. Please try again.' },
            { status: 500 }
        )
    }
}
