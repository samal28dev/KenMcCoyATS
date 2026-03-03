import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Email from '@/models/Email'
import EmailTemplate from '@/models/EmailTemplate'
import { sendEmail } from '@/lib/email-sender'
import {
    addWatermarkToPdf, removePiiFromPdf, removePiiFromText, removeCTCFromText,
    loadFileData, saveFileData, convertPdfToDocx, convertDocxToPdf,
} from '@/lib/document-processing'
import { emitRealtimeEvent } from '@/lib/socket'
import { logActivity } from '@/lib/activity-feed'

// POST /api/emails/send — compose and send email with attachments
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()

        const {
            to, cc, bcc, subject, content, templateId,
            candidateId, clientId, positionId,
            attachmentFilenames,           // filenames from MongoDB FileStore
            processActions,                // { resume: ['watermark','removePii'], jd: ['removeCTC'] }
        } = body

        if (!to || !subject || !content) {
            return NextResponse.json({ error: 'to, subject, and content are required' }, { status: 400 })
        }

        // If using a template, increment use count
        if (templateId) {
            await EmailTemplate.findByIdAndUpdate(templateId, {
                $inc: { useCount: 1 },
                lastUsed: new Date(),
            })
        }

        // Process attachments (watermark, PII removal, etc.)
        const finalAttachments: string[] = []
        if (attachmentFilenames && Array.isArray(attachmentFilenames)) {
            for (const fname of attachmentFilenames) {
                // Verify file exists in MongoDB (or filesystem fallback)
                const fileData = await loadFileData(fname)
                if (!fileData) continue

                let processedName = fname
                const isPdf = fname.toLowerCase().endsWith('.pdf')
                const actions = processActions || {}

                // Apply processing actions
                if (actions.watermark && isPdf) {
                    processedName = await addWatermarkToPdf(processedName)
                }
                if (actions.removePii) {
                    if (isPdf) {
                        processedName = await removePiiFromPdf(processedName)
                    } else {
                        const data = await loadFileData(processedName)
                        if (data) {
                            const redacted = removePiiFromText(data.toString('utf-8'))
                            const outputName = `redacted_${processedName}`
                            await saveFileData(outputName, Buffer.from(redacted), {
                                originalName: outputName,
                                contentType: 'text/plain',
                            })
                            processedName = outputName
                        }
                    }
                }
                if (actions.removeCTC) {
                    const data = await loadFileData(processedName)
                    if (data) {
                        const cleaned = removeCTCFromText(data.toString('utf-8'))
                        const outputName = `noctc_${processedName}`
                        await saveFileData(outputName, Buffer.from(cleaned), {
                            originalName: outputName,
                            contentType: 'text/plain',
                        })
                        processedName = outputName
                    }
                }

                finalAttachments.push(processedName)

                // Dual-format: also attach the converted PDF↔DOCX version
                if (actions.attachBothFormats) {
                    try {
                        const isDocx = fname.toLowerCase().endsWith('.docx') || fname.toLowerCase().endsWith('.doc')
                        // Look up existing converted version in FileStore
                        const FileStore = (await import('@/models/FileStore')).default
                        const convertedPrefix = `converted_${fname.replace(/\.(pdf|docx?)$/i, '')}`
                        const existing = await FileStore.findOne({
                            filename: { $regex: new RegExp(`^converted_.*${fname.replace(/\.(pdf|docx?)$/i, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }
                        }).select('filename').lean() as any

                        if (existing) {
                            // Use already-converted version from upload time
                            finalAttachments.push(existing.filename)
                        } else {
                            // Convert on the fly
                            if (isPdf) {
                                const docxFile = await convertPdfToDocx(fname)
                                finalAttachments.push(docxFile)
                            } else if (isDocx) {
                                const pdfFile = await convertDocxToPdf(fname)
                                finalAttachments.push(pdfFile)
                            }
                        }
                    } catch (convErr) {
                        console.warn('Dual-format conversion failed (non-blocking):', convErr)
                    }
                }
            }
        }

        // Send the email via SMTP or fallback to mailto
        const sendResult = await sendEmail({
            userId: user._id.toString(),
            to,
            cc: cc || undefined,
            bcc: bcc || undefined,
            subject,
            body: content,
            attachmentFilenames: finalAttachments.length > 0 ? finalAttachments : undefined,
        })

        // Record the email in the database regardless of send method
        const email = await Email.create({
            from: user._id,
            to,
            cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
            bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [],
            subject,
            content,
            templateId: templateId || undefined,
            candidateId: candidateId || undefined,
            clientId: clientId || undefined,
            positionId: positionId || undefined,
            attachments: finalAttachments.map(f => ({
                filename: f,
                storagePath: f,
            })),
            status: sendResult.success ? 'sent' : 'draft',
            sentAt: sendResult.success ? new Date() : undefined,
        })

        emitRealtimeEvent('email:sent', {
            emailId: email._id.toString(),
            to,
            subject,
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'email_sent',
            targetType: 'candidate',
            targetId: candidateId || email._id.toString(),
            targetName: `Email to ${to}`,
            metadata: { subject, to },
        })

        if (sendResult.success) {
            return NextResponse.json({
                success: true,
                email,
                method: 'smtp',
                messageId: sendResult.messageId,
                message: `Email sent successfully to ${to}${finalAttachments.length > 0 ? ` with ${finalAttachments.length} attachment(s)` : ''}`,
            }, { status: 201 })
        } else {
            return NextResponse.json({
                success: false,
                email,
                method: 'mailto',
                mailtoLink: sendResult.mailtoLink,
                smtpError: sendResult.error,
                message: sendResult.error || 'SMTP not configured',
            }, { status: 201 })
        }
    } catch (error) {
        console.error('Email send error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// GET /api/emails/send — get email history
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const candidateId = searchParams.get('candidateId')
        const clientId = searchParams.get('clientId')
        const limit = parseInt(searchParams.get('limit') || '50')

        const filter: any = {}
        if (candidateId) filter.candidateId = candidateId
        if (clientId) filter.clientId = clientId

        const emails = await Email.find(filter)
            .populate('from', 'name email')
            .sort({ sentAt: -1 })
            .limit(limit)
            .lean()

        return NextResponse.json(emails)
    } catch (error) {
        console.error('Email list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
