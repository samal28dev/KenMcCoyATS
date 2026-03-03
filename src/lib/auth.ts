import jwt from 'jsonwebtoken'
import { headers, cookies } from 'next/headers'
import dbConnect from './db'
import User from '../models/User'

const JWT_SECRET = process.env.JWT_SECRET

export async function verifyAuth() {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET missing in environment')
    }

    // Try Authorization header first, then fall back to httpOnly cookie
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

    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, role: string }
        await dbConnect()
        const user = await User.findById(decoded.userId).select('-password')
        return user
    } catch (error) {
        return null
    }
}

export function signToken(userId: string, role: string) {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET missing in environment')
    }
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' })
}
