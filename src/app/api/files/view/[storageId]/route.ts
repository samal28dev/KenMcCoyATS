import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import FileStore from '@/models/FileStore'
import { addWatermarkToPdf, removePiiFromPdf, loadFileData } from '@/lib/document-processing'
import path from 'path'
import crypto from 'crypto'

function bufferResponse(data: Buffer, contentType: string, filename: string) {
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Length', data.length.toString())
    headers.set('Content-Disposition', `inline; filename="${filename}"`)
    return new Response(new Blob([Uint8Array.from(data)], { type: contentType }), { status: 200, headers })
}

/**
 * GET /api/files/view/[storageId]?mask=true
 *
 * Always returns a watermarked PDF. When ?mask=true, also strips PII.
 * Processed versions are cached in FileStore so processing only happens once.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ storageId: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { storageId } = await params
        const maskPii = request.nextUrl.searchParams.get('mask') === 'true'
        await dbConnect()

        const ext = path.extname(storageId).toLowerCase()
        const isPdf = ext === '.pdf'

        if (!isPdf) {
            // Non-PDF — serve original as-is
            const raw = await loadFileData(storageId)
            if (!raw) return NextResponse.json({ error: 'File not found' }, { status: 404 })
            const contentTypes: Record<string, string> = {
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.txt': 'text/plain',
            }
            return bufferResponse(raw, contentTypes[ext] || 'application/octet-stream', storageId)
        }

        const watermarkedFilename = `wm_${storageId}`
        const maskedFilename = `masked_wm_${storageId}`

        // ── STEP 1: Ensure watermarked version exists ──
        let wmExists = !!(await FileStore.findOne({ filename: watermarkedFilename }).select('_id').lean())
        if (!wmExists) {
            try {
                await addWatermarkToPdf(storageId)
                wmExists = true
            } catch (err) {
                console.error('[View] Watermark failed — serving original:', err)
            }
        }
        const baseFilename = wmExists ? watermarkedFilename : storageId

        // ── STEP 2: If mask=true, ensure PII-masked version exists ──
        if (maskPii) {
            const maskedExists = !!(await FileStore.findOne({ filename: maskedFilename }).select('_id').lean())
            if (!maskedExists) {
                try {
                    await removePiiFromPdf(baseFilename)
                    const redactedName = `redacted_${baseFilename}`
                    const redactedData = await loadFileData(redactedName)
                    if (redactedData) {
                        await FileStore.findOneAndUpdate(
                            { filename: maskedFilename },
                            {
                                $set: {
                                    filename: maskedFilename,
                                    originalName: `masked_${storageId}`,
                                    contentType: 'application/pdf',
                                    size: redactedData.length,
                                    data: redactedData,
                                    fileType: 'resume',
                                    hash: crypto.createHash('md5').update(redactedData).digest('hex'),
                                },
                            },
                            { upsert: true }
                        )
                    }
                } catch (err) {
                    console.error('[View] PII mask failed — using watermarked only:', err)
                }
            }
            const maskedData = await loadFileData(maskedFilename)
            if (maskedData) return bufferResponse(maskedData, 'application/pdf', `masked_${storageId}`)
        }

        // ── STEP 3: Serve watermarked PDF (or original if watermark failed) ──
        const data = await loadFileData(baseFilename)
        if (!data) return NextResponse.json({ error: 'File not found' }, { status: 404 })
        return bufferResponse(data, 'application/pdf', baseFilename)

    } catch (error) {
        console.error('[View] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
