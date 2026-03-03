import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import { encrypt } from '@/lib/crypto'

// PATCH /api/auth/me — update own profile
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { name, phone, department, emailConfig, notificationPreferences } = body

        const updates: any = {}
        if (name) updates.name = name
        if (phone !== undefined) updates.phone = phone
        if (department !== undefined) updates.department = department
        if (notificationPreferences && typeof notificationPreferences === 'object') {
            for (const k of ['statusChanges', 'comments', 'assignments', 'agreements'] as const) {
                if (typeof notificationPreferences[k] === 'boolean') {
                    updates[`notificationPreferences.${k}`] = notificationPreferences[k]
                }
            }
        }
        if (emailConfig) {
            updates['emailConfig.outlookEmail'] = emailConfig.outlookEmail || ''
            updates['emailConfig.outlookPassword'] = emailConfig.outlookPassword
                ? encrypt(emailConfig.outlookPassword)
                : ''
            updates['emailConfig.isConfigured'] = !!(emailConfig.outlookEmail && emailConfig.outlookPassword)
        }

        const updated = await User.findByIdAndUpdate(user._id, updates, { new: true })
            .select('-password')
            .lean()

        if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Profile update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
