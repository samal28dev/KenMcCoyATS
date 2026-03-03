/**
 * Hash utilities for resume duplicate detection.
 * Uses a simple but effective approach compatible with browser + Node.js environments.
 */

/**
 * Generate a deterministic hash of resume text content (browser-compatible via Web Crypto)
 */
export async function hashResumeText(text: string): Promise<string> {
    // Normalize text: lowercase, collapse whitespace, remove punctuation variations
    const normalized = text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000) // Use first 5000 chars for hash (representative of content)

    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compare two resume hashes and determine if they are duplicates
 */
export function isDuplicate(hash1: string, hash2: string): boolean {
    return hash1 === hash2
}

/**
 * Determine if a resume is "recent" (less than 30 days since last parsed)
 */
export function isRecentlyParsed(lastParsedAt: string, thresholdDays = 30): boolean {
    const lastParsed = new Date(lastParsedAt)
    const now = new Date()
    const diffMs = now.getTime() - lastParsed.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays < thresholdDays
}

/**
 * Get days since last parsed
 */
export function daysSinceLastParsed(lastParsedAt: string): number {
    const lastParsed = new Date(lastParsedAt)
    const now = new Date()
    return Math.floor((now.getTime() - lastParsed.getTime()) / (1000 * 60 * 60 * 24))
}
