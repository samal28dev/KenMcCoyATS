import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import dbConnect from './db'
import User from '../models/User'
import FileStore from '../models/FileStore'
import { decrypt } from './crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

interface SendEmailOptions {
    userId: string
    to: string
    cc?: string
    bcc?: string
    subject: string
    body: string
    htmlBody?: string
    attachmentFilenames?: string[] // filenames stored in MongoDB or uploads/
}

interface SendResult {
    success: boolean
    messageId?: string
    error?: string
    method: 'smtp' | 'mailto'
    mailtoLink?: string
}

/**
 * Send an email via the user's configured Outlook SMTP.
 * If SMTP is not configured, falls back to generating a mailto link.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendResult> {
    await dbConnect()

    const user = await User.findById(options.userId).select('emailConfig email name').lean() as any
    if (!user) {
        return { success: false, error: 'User not found', method: 'mailto' }
    }

    const smtpConfigured = user.emailConfig?.isConfigured &&
        user.emailConfig?.outlookEmail &&
        user.emailConfig?.outlookPassword

    if (smtpConfigured) {
        const decryptedPassword = decrypt(user.emailConfig.outlookPassword) || user.emailConfig.outlookPassword
        return sendViaSMTP({
            ...options,
            fromEmail: user.emailConfig.outlookEmail,
            fromPassword: decryptedPassword,
            fromName: user.name || user.fullName || 'Ken McCoy Consulting',
        })
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return sendViaSMTP({
            ...options,
            fromEmail: process.env.SMTP_USER,
            fromPassword: process.env.SMTP_PASS,
            fromName: user.name || 'Ken McCoy Consulting',
            smtpHost: process.env.SMTP_HOST,
            smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        })
    }

    // No SMTP configured, falling back to mailto
    const params = new URLSearchParams()
    params.set('subject', options.subject)
    params.set('body', options.body)
    if (options.cc) params.set('cc', options.cc)
    if (options.bcc) params.set('bcc', options.bcc)
    const mailtoLink = `mailto:${options.to}?${params.toString()}`

    return {
        success: false,
        method: 'mailto',
        mailtoLink,
        error: 'SMTP not configured. Configure your Outlook email in Settings → Profile to send emails with attachments directly from this tool.',
    }
}

async function sendViaSMTP(options: SendEmailOptions & {
    fromEmail: string
    fromPassword: string
    fromName: string
    smtpHost?: string
    smtpPort?: number
}): Promise<SendResult> {
    try {
        const transporter = nodemailer.createTransport({
            host: options.smtpHost || 'smtp.office365.com',
            port: options.smtpPort || 587,
            secure: false,
            auth: {
                user: options.fromEmail,
                pass: options.fromPassword,
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: false,
            },
        })

        // Build attachments — load from MongoDB first, filesystem fallback
        const attachments: any[] = []
        if (options.attachmentFilenames) {
            for (const fname of options.attachmentFilenames) {
                const stored = await FileStore.findOne({ filename: fname }).select('data originalName contentType')
                if (stored) {
                    attachments.push({
                        filename: stored.originalName || fname,
                        content: stored.data,
                        contentType: stored.contentType,
                    })
                } else {
                    // Fallback: filesystem for old uploads
                    const filePath = path.join(UPLOADS_DIR, fname)
                    if (fs.existsSync(filePath)) {
                        attachments.push({ filename: fname, path: filePath })
                    }
                }
            }
        }

        const mailOptions: any = {
            from: `"${options.fromName}" <${options.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            text: options.body,
            attachments,
        }

        if (options.cc) mailOptions.cc = options.cc
        if (options.bcc) mailOptions.bcc = options.bcc
        if (options.htmlBody) mailOptions.html = options.htmlBody

        const info = await transporter.sendMail(mailOptions)

        return {
            success: true,
            messageId: info.messageId,
            method: 'smtp',
        }
    } catch (error: any) {
        console.error('[Email] SMTP send failed:', error.message)
        return {
            success: false,
            error: error.message,
            method: 'smtp',
        }
    }
}
