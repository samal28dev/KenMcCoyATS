import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import JDParser from '@/lib/jd-parser'

export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
        }

        let jdText = ''
        const fileName = file.name.toLowerCase()

        if (fileName.endsWith('.txt')) {
            jdText = await file.text()
        } else if (fileName.endsWith('.pdf')) {
            try {
                const pdf = require('pdf-parse')
                const buffer = await file.arrayBuffer()

                const data = await pdf(Buffer.from(buffer))
                jdText = data.text
            } catch (error) {
                console.error('PDF parsing error:', error)
                return NextResponse.json(
                    { error: 'Failed to parse PDF file. Please try a text or Word file.' },
                    { status: 500 }
                )
            }
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
            try {
                const mammoth = require('mammoth')
                const buffer = await file.arrayBuffer()
                const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
                jdText = result.value
                if (!jdText || jdText.trim().length === 0) {
                    return NextResponse.json(
                        { error: 'Could not extract text from Word document. The file may be empty or corrupted.' },
                        { status: 400 }
                    )
                }
            } catch (error) {
                console.error('DOCX parsing error:', error)
                return NextResponse.json(
                    { error: 'Failed to parse Word document. Please try a PDF or text file.' },
                    { status: 500 }
                )
            }
        } else {
            return NextResponse.json(
                { error: 'Unsupported file type. Please upload a PDF, DOC, DOCX, or TXT file.' },
                { status: 400 }
            )
        }

        if (!jdText.trim()) {
            return NextResponse.json(
                { error: 'No text could be extracted from the uploaded file.' },
                { status: 400 }
            )
        }

        // Parse the JD text
        const parser = new JDParser(process.env.OPENAI_API_KEY)
        const data = await parser.parseJD(jdText, file.name)

        return NextResponse.json({ data })
    } catch (error) {
        console.error('JD parse error:', error)
        return NextResponse.json(
            { error: 'Failed to parse job description' },
            { status: 500 }
        )
    }
}
