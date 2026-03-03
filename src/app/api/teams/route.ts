import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import User from '../../../models/User'
import { verifyAuth } from '../../../lib/auth'

// GET /api/teams — list team members
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(req.url)
        const role = searchParams.get('role')

        const filter: any = { isActive: true }
        if (role) filter.role = role

        const members = await User.find(filter)
            .select('-password -apiKey -resetPasswordToken -resetPasswordExpires')
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json(members)
    } catch (error) {
        console.error('Teams list error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
