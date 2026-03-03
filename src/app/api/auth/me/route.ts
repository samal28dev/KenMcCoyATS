import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import dbConnect from '../../../../lib/db'
import User from '../../../../models/User'
import { headers, cookies } from 'next/headers'

export async function GET(req: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')
        let token: string | undefined

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]
        }

        if (!token) {
            const cookieStore = await cookies()
            token = cookieStore.get('ats_token')?.value
        }

        if (!token) {
            return NextResponse.json({ message: 'No token' }, { status: 401 })
        }

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET missing')
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string, role: string }

        await dbConnect()
        const user = await User.findById(decoded.userId).select('-password -apiKey')

        if (!user) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 })
        }

        return NextResponse.json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name || user.fullName,
                role: user.role,
                avatar: user.avatar,
                phone: user.phone,
                department: user.department,
                emailConfig: user.emailConfig ? {
                    outlookEmail: user.emailConfig.outlookEmail || '',
                    outlookPassword: user.emailConfig.outlookPassword ? '••••••••' : '',
                    isConfigured: !!user.emailConfig.isConfigured,
                } : { outlookEmail: '', outlookPassword: '', isConfigured: false },
                notificationPreferences: user.notificationPreferences || {
                    statusChanges: true,
                    comments: true,
                    assignments: true,
                    agreements: true,
                },
            }
        })
    } catch (error) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
}
