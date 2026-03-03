import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Client from '@/models/Client'
import User from '@/models/User'
import { notifyUser } from '@/lib/notify'

// GET /api/agreements/check — check for expiring agreements (within 30 days)
// Called on dashboard load or via external cron
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        const today = new Date()

        // Find clients with agreements expiring within 30 days
        const expiringClients = await Client.find({
            agreementValidTill: {
                $gte: today,
                $lte: thirtyDaysFromNow,
            },
            status: 'active',
        })
            .populate('assignedTo', 'name email')
            .lean()

        // Already expired
        const expiredClients = await Client.find({
            agreementValidTill: { $lt: today },
            status: 'active',
        })
            .populate('assignedTo', 'name email')
            .lean()

        // Send notifications to admins and ops heads
        const admins = await User.find({
            role: { $in: ['super_admin', 'operations_head'] },
        }).select('_id').lean()

        for (const client of expiringClients as any[]) {
            const daysLeft = Math.ceil((new Date(client.agreementValidTill).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

            for (const admin of admins) {
                await notifyUser({
                    senderId: user._id,
                    recipientId: (admin as any)._id.toString(),
                    action: 'agreement_expiring',
                    entityType: 'client',
                    entityId: client._id.toString(),
                    title: `Agreement Expiring - ${client.companyName}`,
                    message: `Agreement with "${client.companyName}" expires in ${daysLeft} days (${new Date(client.agreementValidTill).toLocaleDateString()})`,
                })
            }
        }

        return NextResponse.json({
            expiring: expiringClients.map((c: any) => ({
                _id: c._id,
                companyName: c.companyName,
                agreementValidTill: c.agreementValidTill,
                daysLeft: Math.ceil((new Date(c.agreementValidTill).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
                assignedTo: c.assignedTo?.name || '',
            })),
            expired: expiredClients.map((c: any) => ({
                _id: c._id,
                companyName: c.companyName,
                agreementValidTill: c.agreementValidTill,
                assignedTo: c.assignedTo?.name || '',
            })),
            notificationsSent: expiringClients.length * admins.length,
        })
    } catch (error) {
        console.error('Agreement check error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
