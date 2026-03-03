import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Email from '@/models/Email'
import { sendEmail } from '@/lib/email-sender'
import { emitRealtimeEvent } from '@/lib/socket'
import { writeAuditLog } from '@/lib/audit-log'

/**
 * POST /api/emails/bulk-send — send an email to multiple recipients.
 * Body: { recipients: string[], subject: string, content: string, candidateIds?: string[] }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { recipients, subject, content, candidateIds } = body

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ error: 'recipients array is required' }, { status: 400 })
        }
        if (!subject || !content) {
            return NextResponse.json({ error: 'subject and content are required' }, { status: 400 })
        }
        if (recipients.length > 50) {
            return NextResponse.json({ error: 'Maximum 50 recipients per bulk send' }, { status: 400 })
        }

        const results: { to: string; success: boolean; error?: string }[] = []

        for (const to of recipients) {
            try {
                const sendResult = await sendEmail({
                    userId: user._id.toString(),
                    to,
                    subject,
                    body: content,
                })

                // Record each email
                await Email.create({
                    from: user._id,
                    to,
                    subject,
                    content,
                    candidateId: candidateIds?.shift() || undefined,
                    status: sendResult.success ? 'sent' : 'draft',
                    sentAt: sendResult.success ? new Date() : undefined,
                })

                results.push({ to, success: sendResult.success, error: sendResult.error })
            } catch (err: any) {
                results.push({ to, success: false, error: err.message })
            }
        }

        const successCount = results.filter(r => r.success).length

        emitRealtimeEvent('email:sent', {
            bulk: true,
            count: successCount,
            actorId: user._id.toString(),
        })

        await writeAuditLog({
            action: 'bulk_email',
            entityType: 'email',
            entityId: 'bulk',
            performedBy: user._id.toString(),
            performedByName: user.name || 'User',
            changes: { recipientCount: recipients.length, successCount, subject },
        })

        return NextResponse.json({
            success: true,
            total: recipients.length,
            sent: successCount,
            failed: recipients.length - successCount,
            results,
        }, { status: 201 })
    } catch (error) {
        console.error('Bulk email error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
