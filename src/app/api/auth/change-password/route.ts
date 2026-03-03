import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

// POST /api/auth/change-password
export async function POST(request: NextRequest) {
    try {
        const authUser = await verifyAuth()
        if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { currentPassword, newPassword } = body

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
        }

        const user = await User.findById(authUser._id)
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }

        user.password = await bcrypt.hash(newPassword, 10)
        await user.save()

        return NextResponse.json({ message: 'Password updated successfully' })
    } catch (error) {
        console.error('Password change error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
