import { NextResponse } from 'next/server'
import crypto from 'crypto'
import dbConnect from '../../../../lib/db'
import User from '../../../../models/User'
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit'
import { sendPasswordResetEmail } from '../../../../lib/password-reset'

export async function POST(req: Request) {
    try {
        // Rate limit: 3 requests per minute per IP
        const ip = getClientIP(req)
        const rateCheck = checkRateLimit(`forgot-password:${ip}`, { maxRequests: 3, windowSeconds: 60 })
        if (!rateCheck.success) {
            return NextResponse.json(
                { message: `Too many requests. Try again in ${rateCheck.retryAfter}s` },
                { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
            )
        }

        await dbConnect()
        const body = await req.json()
        const { email } = body

        if (!email) {
            return NextResponse.json({ message: 'Email is required' }, { status: 400 })
        }

        // Always return success to prevent email enumeration
        const successMessage = 'If an account with that email exists, a password reset link has been sent.'

        const user = await User.findOne({ email: email.toLowerCase().trim() })
        if (!user) {
            return NextResponse.json({ message: successMessage })
        }

        // Generate a secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex')
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')

        // Store hashed token and expiry (1 hour)
        user.resetPasswordToken = resetTokenHash
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000)
        await user.save()

        // Build reset URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`

        // Send email
        await sendPasswordResetEmail({
            to: user.email,
            userName: user.name || user.fullName || 'User',
            resetUrl,
        })

        return NextResponse.json({ message: successMessage })
    } catch (error) {
        console.error('Forgot password error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
