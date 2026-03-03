import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import dbConnect from '../../../../lib/db'
import User from '../../../../models/User'
import { signToken } from '../../../../lib/auth'
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit'
import crypto from 'crypto'

export async function POST(req: Request) {
    try {
        // Rate limit: 3 registrations per minute per IP
        const ip = getClientIP(req)
        const rateCheck = checkRateLimit(`register:${ip}`, { maxRequests: 3, windowSeconds: 60 })
        if (!rateCheck.success) {
            return NextResponse.json(
                { message: `Too many registration attempts. Try again in ${rateCheck.retryAfter}s` },
                { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
            )
        }

        await dbConnect()
        const body = await req.json()
        const { name, email, password } = body

        if (!name || !email || !password) {
            return NextResponse.json({ message: 'Name, email and password required' }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 })
        }

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return NextResponse.json({ message: 'Email already registered' }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        // First user is super_admin, all subsequent self-registrations are recruiter only
        const count = await User.countDocuments()
        const assignedRole = count === 0 ? 'super_admin' : 'recruiter'

        const user = await User.create({
            name,
            fullName: name, // For CRM compat
            email,
            password: hashedPassword,
            role: assignedRole,
            apiKey: crypto.randomBytes(32).toString('hex') // For CRM compat
        })

        const token = signToken(user._id.toString(), user.role)

        const response = NextResponse.json({
            message: 'Registration successful',
            token,
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        }, { status: 201 })

        response.cookies.set('ats_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60
        })

        return response
    } catch (error) {
        console.error('Registration error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
