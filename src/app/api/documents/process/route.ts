import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import {
    addWatermarkToPdf,
    removePiiFromPdf,
    removePiiFromText,
    removeCTCFromText,
    convertPdfToDocx,
    convertDocxToPdf,
    loadFileData,
    saveFileData,
} from '@/lib/document-processing'

// POST /api/documents/process — apply watermark, PII removal, CTC removal
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { filename, actions } = body
        // actions: ['watermark', 'removePii', 'removeCTC', 'convertToDocx', 'convertToPdf']

        if (!filename) {
            return NextResponse.json({ error: 'filename is required' }, { status: 400 })
        }

        // Check file exists in MongoDB or filesystem
        const fileData = await loadFileData(filename)
        if (!fileData) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        const results: Record<string, string> = {}
        const isPdf = filename.toLowerCase().endsWith('.pdf')

        if (actions.includes('watermark') && isPdf) {
            results.watermarked = await addWatermarkToPdf(filename)
        }

        if (actions.includes('removePii') && isPdf) {
            results.piiRedacted = await removePiiFromPdf(filename)
        }

        if (actions.includes('removePii') && !isPdf) {
            // For text-based files
            const content = fileData.toString('utf-8')
            const redacted = removePiiFromText(content)
            const outputName = `redacted_${filename}`
            await saveFileData(outputName, Buffer.from(redacted), {
                originalName: `redacted_${filename}`,
                contentType: 'text/plain',
            })
            results.piiRedacted = outputName
        }

        if (actions.includes('removeCTC')) {
            const content = fileData.toString('utf-8')
            const cleaned = removeCTCFromText(content)
            const outputName = `noctc_${filename}`
            await saveFileData(outputName, Buffer.from(cleaned), {
                originalName: `noctc_${filename}`,
                contentType: 'text/plain',
            })
            results.ctcRemoved = outputName
        }

        // PDF → DOCX conversion
        if (actions.includes('convertToDocx') && isPdf) {
            results.docxVersion = await convertPdfToDocx(filename)
        }

        // DOCX → PDF conversion
        const isDocx = filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')
        if (actions.includes('convertToPdf') && isDocx) {
            results.pdfVersion = await convertDocxToPdf(filename)
        }

        return NextResponse.json({
            success: true,
            original: filename,
            processed: results,
            downloadUrls: Object.fromEntries(
                Object.entries(results).map(([key, name]) => [key, `/api/files/download/${name}`])
            ),
        })
    } catch (error) {
        console.error('Document process error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
