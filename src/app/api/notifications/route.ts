import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Notification from '../../../models/Notification'
import { verifyAuth } from '../../../lib/auth'

// GET /api/notifications — get notifications for current user
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const unreadOnly = searchParams.get('unread') === 'true'

        const filter: any = { recipientId: user._id }
        if (unreadOnly) filter.isRead = false

        const notifications = await Notification.find(filter)
            .populate('senderId', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean()

        const unreadCount = await Notification.countDocuments({ recipientId: user._id, isRead: false })

        return NextResponse.json({ notifications, unreadCount })
    } catch (error) {
        console.error('Notifications error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/notifications — mark as read
export async function PATCH(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await req.json()
        const { ids, markAll } = body

        if (markAll) {
            await Notification.updateMany({ recipientId: user._id, isRead: false }, { isRead: true })
        } else if (ids?.length) {
            await Notification.updateMany({ _id: { $in: ids }, recipientId: user._id }, { isRead: true })
        }

        return NextResponse.json({ message: 'Notifications updated' })
    } catch (error) {
        console.error('Notifications update error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
