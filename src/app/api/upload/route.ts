import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import FileStore from '@/models/FileStore'
import { addWatermarkToPdf } from '@/lib/document-processing'
import crypto from 'crypto'
import path from 'path'

export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await dbConnect()

        const formData = await request.formData()
        const file = formData.get('file') as File
        const type = formData.get('type') as string || 'document' // 'resume' | 'jd' | 'document'
        const entityId = formData.get('entityId') as string
        const entityType = formData.get('entityType') as string // 'candidate' | 'position'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
        }

        // Validate file type
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls']
        const ext = path.extname(file.name).toLowerCase()
        if (!allowedExtensions.includes(ext)) {
            return NextResponse.json(
                { error: `Unsupported file type. Allowed: ${allowedExtensions.join(', ')}` },
                { status: 400 }
            )
        }

        // Generate unique filename
        const hash = crypto.randomBytes(8).toString('hex')
        const timestamp = Date.now()
        const safeOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const uniqueFilename = `${type}_${timestamp}_${hash}_${safeOriginalName}`

        // Read file into buffer
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileHash = crypto.createHash('md5').update(buffer).digest('hex')

        // Determine content type
        const contentTypeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
        }

        // Store in MongoDB
        const stored = await FileStore.create({
            filename: uniqueFilename,
            originalName: file.name,
            contentType: contentTypeMap[ext] || 'application/octet-stream',
            size: file.size,
            data: buffer,
            fileType: type,
            hash: fileHash,
            uploadedBy: user._id,
            entityType: entityType || '',
            entityId: entityId || undefined,
        })

        // ── AUTO-CONVERT: Store both PDF + DOCX versions ──
        let pdfVersion: string | null = null
        let docxVersion: string | null = null

        if ((type === 'resume' || type === 'jd') && (ext === '.pdf' || ext === '.docx' || ext === '.doc')) {
            try {
                if (ext === '.pdf') {
                    pdfVersion = uniqueFilename
                    // Convert PDF → DOCX
                    const convertedBuf = await convertPdfToDocxBuffer(buffer)
                    if (convertedBuf) {
                        const docxName = uniqueFilename.replace(/\.pdf$/i, '.docx')
                        const convName = `converted_${docxName}`
                        await FileStore.create({
                            filename: convName,
                            originalName: file.name.replace(/\.pdf$/i, '.docx'),
                            contentType: contentTypeMap['.docx'],
                            size: convertedBuf.length,
                            data: convertedBuf,
                            fileType: type,
                            hash: crypto.createHash('md5').update(convertedBuf).digest('hex'),
                            uploadedBy: user._id,
                            entityType: entityType || '',
                            entityId: entityId || undefined,
                        })
                        docxVersion = convName
                    }
                } else if (ext === '.docx' || ext === '.doc') {
                    docxVersion = uniqueFilename
                    // Convert DOCX → PDF
                    const convertedBuf = await convertDocxToPdfBuffer(buffer)
                    if (convertedBuf) {
                        const pdfName = uniqueFilename.replace(/\.docx?$/i, '.pdf')
                        const convName = `converted_${pdfName}`
                        await FileStore.create({
                            filename: convName,
                            originalName: file.name.replace(/\.docx?$/i, '.pdf'),
                            contentType: contentTypeMap['.pdf'],
                            size: convertedBuf.length,
                            data: convertedBuf,
                            fileType: type,
                            hash: crypto.createHash('md5').update(convertedBuf).digest('hex'),
                            uploadedBy: user._id,
                            entityType: entityType || '',
                            entityId: entityId || undefined,
                        })
                        pdfVersion = convName
                    }
                }
            } catch (convErr) {
                console.warn('Auto-conversion failed (non-blocking):', convErr)
            }
        }

        // ── AUTO-WATERMARK: Apply KMC watermark to resume PDFs ──
        let watermarkedVersion: string | null = null
        if (type === 'resume' && ext === '.pdf') {
            try {
                watermarkedVersion = await addWatermarkToPdf(uniqueFilename)
            } catch (wmErr) {
                console.warn('Auto-watermark failed (non-blocking):', wmErr)
            }
        }

        return NextResponse.json({
            success: true,
            storageId: uniqueFilename,
            file: {
                filename: uniqueFilename,
                originalName: file.name,
                size: file.size,
                type: file.type,
                extension: ext,
                hash: fileHash,
                url: `/api/files/${uniqueFilename}`,
                pdfVersion: pdfVersion || null,
                docxVersion: docxVersion || null,
                watermarkedVersion: watermarkedVersion || null,
            }
        })
    } catch (error) {
        console.error('File upload error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── In-memory PDF → DOCX conversion ──
async function convertPdfToDocxBuffer(pdfBuffer: Buffer): Promise<Buffer | null> {
    try {
        const pdfParse = require('pdf-parse')
        const pdfData = await pdfParse(pdfBuffer)
        const text = pdfData.text

        const { Document, Packer, Paragraph, TextRun, Header, Footer } = require('docx')

        const paragraphs = text.split('\n').filter((l: string) => l.trim()).map((line: string) =>
            new Paragraph({
                children: [new TextRun({ text: line, size: 22 })],
                spacing: { after: 120 },
            })
        )

        const doc = new Document({
            sections: [{
                headers: {
                    default: new Header({
                        children: [new Paragraph({
                            children: [new TextRun({ text: 'Profile sourced by Ken McCoy Consulting', size: 16, color: '666699' })],
                        })],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            children: [new TextRun({ text: 'Ken McCoy Consulting', size: 14, color: '999999' })],
                        })],
                    }),
                },
                children: paragraphs,
            }],
        })

        return await Packer.toBuffer(doc)
    } catch (e) {
        console.error('PDF to DOCX conversion error:', e)
        return null
    }
}

// ── In-memory DOCX → PDF conversion ──
async function convertDocxToPdfBuffer(docxBuffer: Buffer): Promise<Buffer | null> {
    try {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer: docxBuffer })
        const text: string = result.value

        const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
        const pdfDoc = await PDFDocument.create()
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const fontSize = 10
        const lineHeight = 14
        const margin = 50
        const pageWidth = 595
        const pageHeight = 842

        const lines = text.split('\n')
        let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
        let yPos = pageHeight - margin

        // Header
        currentPage.drawText('Profile sourced by Ken McCoy Consulting', {
            x: margin, y: pageHeight - 25, size: 8, font: boldFont, color: rgb(0.3, 0.3, 0.6),
        })
        yPos -= 20

        for (const line of lines) {
            if (yPos < margin + 30) {
                currentPage.drawText('Ken McCoy Consulting', {
                    x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
                })
                currentPage = pdfDoc.addPage([pageWidth, pageHeight])
                yPos = pageHeight - margin
            }

            const maxWidth = pageWidth - margin * 2
            const words = line.split(' ')
            let currentLine = ''
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word
                const width = font.widthOfTextAtSize(testLine, fontSize)
                if (width > maxWidth && currentLine) {
                    currentPage.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
                    yPos -= lineHeight
                    currentLine = word
                    if (yPos < margin + 30) {
                        currentPage.drawText('Ken McCoy Consulting', {
                            x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
                        })
                        currentPage = pdfDoc.addPage([pageWidth, pageHeight])
                        yPos = pageHeight - margin
                    }
                } else {
                    currentLine = testLine
                }
            }
            if (currentLine) {
                currentPage.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
                yPos -= lineHeight
            } else {
                yPos -= lineHeight / 2
            }
        }

        // Footer on last page
        currentPage.drawText('Ken McCoy Consulting', {
            x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
        })

        return Buffer.from(await pdfDoc.save())
    } catch (e) {
        console.error('DOCX to PDF conversion error:', e)
        return null
    }
}
