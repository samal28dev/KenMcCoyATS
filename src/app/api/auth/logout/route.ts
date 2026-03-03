import { NextResponse } from 'next/server'

/**
 * POST /api/auth/logout — clear the httpOnly auth cookie
 */
export async function POST() {
    const response = NextResponse.json({ message: 'Logged out' })

    response.cookies.set('ats_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        path: '/',
    })

    return response
}
