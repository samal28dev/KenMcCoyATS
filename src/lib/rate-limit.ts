/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with token bucket logic.
 *
 * For production at scale, replace with Redis-based rate limiting.
 */

interface RateLimitEntry {
    count: number
    resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
        if (entry.resetAt < now) store.delete(key)
    }
}, 5 * 60 * 1000)

interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number
    /** Window duration in seconds */
    windowSeconds: number
}

/**
 * Check rate limit for a given identifier (IP, user ID, etc.)
 * Returns { success: true } if allowed, { success: false, retryAfter } if blocked.
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = { maxRequests: 10, windowSeconds: 60 }
): { success: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now()
    const key = identifier

    const entry = store.get(key)

    if (!entry || entry.resetAt < now) {
        // New window
        store.set(key, {
            count: 1,
            resetAt: now + config.windowSeconds * 1000,
        })
        return { success: true, remaining: config.maxRequests - 1 }
    }

    if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return { success: false, remaining: 0, retryAfter }
    }

    entry.count++
    return { success: true, remaining: config.maxRequests - entry.count }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0].trim()
    const real = request.headers.get('x-real-ip')
    if (real) return real
    return '127.0.0.1'
}
