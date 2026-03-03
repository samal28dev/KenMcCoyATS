import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getKey(): Buffer {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET required for encryption')
    // Derive a 32-byte key from JWT_SECRET using SHA-256
    return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypt a plain-text string. Returns a hex-encoded string (iv:encrypted:tag).
 */
export function encrypt(text: string): string {
    const key = getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`
}

/**
 * Decrypt a hex-encoded string (iv:encrypted:tag) back to plain text.
 * Returns null if decryption fails (e.g. wrong key, corrupted data).
 */
export function decrypt(payload: string): string | null {
    try {
        const parts = payload.split(':')
        if (parts.length !== 3) return null

        const key = getKey()
        const iv = Buffer.from(parts[0], 'hex')
        const encrypted = parts[1]
        const tag = Buffer.from(parts[2], 'hex')

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
        decipher.setAuthTag(tag)

        let decrypted = decipher.update(encrypted, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch {
        return null
    }
}
