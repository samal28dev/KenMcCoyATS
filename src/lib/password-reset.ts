import nodemailer from 'nodemailer'

interface PasswordResetEmailOptions {
    to: string
    userName: string
    resetUrl: string
}

/**
 * Send a password reset email.
 * Uses the system SMTP config from environment variables.
 */
export async function sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const { to, userName, resetUrl } = options

    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const fromName = process.env.APP_NAME || 'EvalATS'

    if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn('SMTP not configured. Password reset email not sent. Reset URL:', resetUrl)
        return
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    })

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
                        <tr>
                            <td style="background-color: #000000; padding: 24px 32px;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">${fromName}</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px;">
                                <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 22px;">Password Reset Request</h2>
                                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                                    Hi ${userName},
                                </p>
                                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                                    We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>1 hour</strong>.
                                </p>
                                <table cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
                                    <tr>
                                        <td style="background-color: #000000; border-radius: 8px;">
                                            <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600;">
                                                Reset Password
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0 0 16px 0;">
                                    If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
                                </p>
                                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                                <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                                    If the button doesn't work, copy and paste this link into your browser:<br/>
                                    <a href="${resetUrl}" style="color: #6b7280; word-break: break-all;">${resetUrl}</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `

    await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to,
        subject: `Reset your password - ${fromName}`,
        text: `Hi ${userName},\n\nWe received a request to reset your password. Visit the link below to create a new password (expires in 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n- ${fromName}`,
        html: htmlBody,
    })
}
