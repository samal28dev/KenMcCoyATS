'use client'

let isRedirecting = false

/**
 * Fetch wrapper that auto-attaches credentials (httpOnly cookie).
 * Use this everywhere instead of raw fetch().
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
    const isFormData = options.body instanceof FormData

    const headers: HeadersInit = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        'X-Requested-With': 'XMLHttpRequest',
        ...(options.headers as Record<string, string>),
    }

    const res = await fetch(url, { ...options, headers, credentials: 'same-origin' })

    if (res.status === 401) {
        // Token expired / invalid — redirect to login (once only)
        if (typeof window !== 'undefined') {
            // Clear the cookie to prevent middleware from redirecting us back to root
            document.cookie = "ats_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"

            if (!isRedirecting) {
                const isAlreadyOnAuth = window.location.pathname.startsWith('/sign-in') ||
                    window.location.pathname.startsWith('/sign-up')
                if (!isAlreadyOnAuth) {
                    isRedirecting = true
                    window.location.href = '/sign-in'
                }
            }
        }
        throw new Error('Unauthorized')
    }

    return res
}
