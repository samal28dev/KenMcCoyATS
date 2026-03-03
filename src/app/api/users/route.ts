import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { canPerformAction } from '@/lib/role-scope'
import dbConnect from '@/lib/db'
import User from '@/models/User'

// GET /api/users — list users (for Ops Head / Admin)
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!canPerformAction(user.role, 'view', 'user')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const role = searchParams.get('role')
        const search = searchParams.get('search')

        const filter: any = {}
        if (role) filter.role = role
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
            ]
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ role: 1, name: 1 })
            .lean()

        return NextResponse.json(users)
    } catch (error) {
        console.error('Users list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/users — update user role (Ops Head / Admin only)
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!canPerformAction(user.role, 'update', 'user')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()
        const body = await request.json()
        const { userId, role, isActive } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        const validRoles = ['super_admin', 'operations_head', 'team_lead', 'recruiter']
        if (role && !validRoles.includes(role)) {
            return NextResponse.json({ error: `Invalid role. Valid: ${validRoles.join(', ')}` }, { status: 400 })
        }

        // Prevent non-super_admin from creating super_admins
        if (role === 'super_admin' && user.role !== 'super_admin') {
            return NextResponse.json({ error: 'Only Super Admin can assign Super Admin role' }, { status: 403 })
        }

        const updates: any = {}
        if (role) updates.role = role
        if (typeof isActive === 'boolean') updates.isActive = isActive

        const updated = await User.findByIdAndUpdate(userId, updates, { new: true })
            .select('-password')
            .lean()

        if (!updated) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json(updated)
    } catch (error) {
        console.error('User update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
