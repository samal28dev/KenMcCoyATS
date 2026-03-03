import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Client from '@/models/Client'
import User from '@/models/User'
import { notifyUser } from '@/lib/notify'

/**
 * GET /api/agreements/cron
 *
 * Automated daily check for expiring client agreements.
 * Designed to be called by:
 *   - A system cron job (e.g., node-cron in server.js)
 *   - An external scheduler (e.g., Vercel Cron, GitHub Actions, uptime monitor)
 *   - Manual trigger
 *
 * Protected by a secret token in the `Authorization` header or `x-cron-secret` header
 * to prevent unauthorized external calls.
 */
export async function GET(request: Request) {
    try {
        // Authenticate: accept either a valid user JWT or a cron secret
        const cronSecret = request.headers.get('x-cron-secret')
        const expectedSecret = process.env.CRON_SECRET

        if (!expectedSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
        }

        if (cronSecret !== expectedSecret) {
            return NextResponse.json({ error: 'Unauthorized cron call' }, { status: 401 })
        }

        await dbConnect()

        const today = new Date()
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

        // Agreements expiring within 30 days
        const expiringClients = await Client.find({
            agreementValidTill: { $gte: today, $lte: thirtyDaysFromNow },
            status: 'active',
        }).lean()

        // Already expired but still marked active
        const expiredClients = await Client.find({
            agreementValidTill: { $lt: today },
            status: 'active',
        }).lean()

        // Get ops heads and admins to notify
        const admins = await User.find({
            role: { $in: ['super_admin', 'operations_head'] },
        }).select('_id').lean()

        let notificationsSent = 0

        for (const client of expiringClients as any[]) {
            const daysLeft = Math.ceil(
                (new Date(client.agreementValidTill).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            )

            for (const admin of admins) {
                await notifyUser({
                    senderId: (admin as any)._id.toString(), // system-initiated
                    recipientId: (admin as any)._id.toString(),
                    action: 'agreement_expiring',
                    entityType: 'client',
                    entityId: client._id.toString(),
                    title: `⚠️ Agreement Expiring - ${client.companyName}`,
                    message: `Agreement with "${client.companyName}" expires in ${daysLeft} day(s) on ${new Date(client.agreementValidTill).toLocaleDateString()}.`,
                })
                notificationsSent++
            }
        }

        for (const client of expiredClients as any[]) {
            for (const admin of admins) {
                await notifyUser({
                    senderId: (admin as any)._id.toString(),
                    recipientId: (admin as any)._id.toString(),
                    action: 'agreement_expiring',
                    entityType: 'client',
                    entityId: client._id.toString(),
                    title: `🔴 Agreement Expired - ${client.companyName}`,
                    message: `Agreement with "${client.companyName}" has expired on ${new Date(client.agreementValidTill).toLocaleDateString()}. Please review.`,
                })
                notificationsSent++
            }
        }

        return NextResponse.json({
            success: true,
            checkedAt: new Date().toISOString(),
            expiringCount: expiringClients.length,
            expiredCount: expiredClients.length,
            notificationsSent,
        })
    } catch (error) {
        console.error('[Cron] Agreement check error:', error)
        return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
    }
}
