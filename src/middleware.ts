import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Verify JWT token in Edge Runtime using Web Crypto API.
 * Returns decoded payload or null if invalid/expired.
 */
async function verifyJWT(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return null

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // Verify signature
    const signatureInput = `${parts[0]}.${parts[1]}`
    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(signatureInput)
    )
    if (!valid) return null

    // Decode payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return { userId: payload.userId, role: payload.role }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('ats_token')?.value

  const isAuthPage = request.nextUrl.pathname.startsWith('/sign-in') ||
    request.nextUrl.pathname.startsWith('/sign-up') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/reset-password')

  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isPublicApiRoute = request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname.startsWith('/api/careers')
  const isCareersPage = request.nextUrl.pathname.startsWith('/careers')
  const isPublicRoute = isAuthPage || isCareersPage || (isApiRoute && isPublicApiRoute)

  // CSRF protection: state-changing API requests must include X-Requested-With header.
  // Browsers won't send custom headers in cross-origin form submissions.
  if (isApiRoute && !isPublicApiRoute) {
    const method = request.method.toUpperCase()
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      const xrw = request.headers.get('x-requested-with')
      if (xrw !== 'XMLHttpRequest') {
        return NextResponse.json({ message: 'Missing CSRF header' }, { status: 403 })
      }
    }
  }

  // No token → redirect/reject unless public route
  if (!token && !isPublicRoute) {
    if (isApiRoute) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/sign-in', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If we have a token on a protected route, verify it
  if (token && !isPublicRoute) {
    const decoded = await verifyJWT(token)
    if (!decoded) {
      // Invalid/expired token — clear cookie and redirect
      if (isApiRoute) {
        return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 })
      }
      const response = NextResponse.redirect(new URL('/sign-in', request.url))
      response.cookies.delete('ats_token')
      return response
    }
  }

  // Redirect to home if user is authenticated and trying to access auth pages
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
