import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import dbConnect from '../../../../lib/db'
import User from '../../../../models/User'
import { signToken } from '../../../../lib/auth'
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit'

export async function POST(req: Request) {
    try {
        // Rate limit: 5 login attempts per minute per IP
        const ip = getClientIP(req)
        const rateCheck = checkRateLimit(`login:${ip}`, { maxRequests: 5, windowSeconds: 60 })
        if (!rateCheck.success) {
            return NextResponse.json(
                { message: `Too many login attempts. Try again in ${rateCheck.retryAfter}s` },
                { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
            )
        }

        await dbConnect()
        const body = await req.json()
        const { email, password } = body

        if (!email || !password) {
            return NextResponse.json({ message: 'Email and password required' }, { status: 400 })
        }

        const user = await User.findOne({ email }).select('+password')

        if (!user) {
            return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
        }

        const token = signToken(user._id.toString(), user.role)

        const response = NextResponse.json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                email: user.email,
                name: user.name || user.fullName,
                role: user.role,
                avatar: user.avatar
            }
        })

        response.cookies.set('ats_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 // 7 days
        })

        return response
    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
