import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import dbConnect from '../../../../lib/db'
import User from '../../../../models/User'
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit'

export async function POST(req: Request) {
    try {
        // Rate limit: 5 requests per minute per IP
        const ip = getClientIP(req)
        const rateCheck = checkRateLimit(`reset-password:${ip}`, { maxRequests: 5, windowSeconds: 60 })
        if (!rateCheck.success) {
            return NextResponse.json(
                { message: `Too many requests. Try again in ${rateCheck.retryAfter}s` },
                { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
            )
        }

        await dbConnect()
        const body = await req.json()
        const { token, email, password } = body

        if (!token || !email || !password) {
            return NextResponse.json({ message: 'Token, email, and new password are required' }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 })
        }

        // Hash the incoming token to compare with stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
        }).select('+password')

        if (!user) {
            return NextResponse.json(
                { message: 'Invalid or expired reset token. Please request a new password reset.' },
                { status: 400 }
            )
        }

        // Hash new password and save
        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(password, salt)
        user.resetPasswordToken = undefined
        user.resetPasswordExpires = undefined
        await user.save()

        return NextResponse.json({ message: 'Password has been reset successfully. You can now sign in.' })
    } catch (error) {
        console.error('Reset password error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
