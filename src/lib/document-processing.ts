import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import dbConnect from './db'
import FileStore from '../models/FileStore'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

/**
 * Load file data — from MongoDB first, filesystem fallback
 */
export async function loadFileData(filename: string): Promise<Buffer | null> {
    await dbConnect()
    const stored = await FileStore.findOne({ filename }).select('data')
    if (stored?.data) return stored.data

    // Filesystem fallback
    const filePath = path.join(UPLOADS_DIR, filename)
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath)
    }
    return null
}

/**
 * Save processed file — to MongoDB
 */
export async function saveFileData(filename: string, data: Buffer, opts: {
    originalName?: string
    contentType?: string
    fileType?: string
    uploadedBy?: string
} = {}): Promise<string> {
    await dbConnect()
    await FileStore.findOneAndUpdate(
        { filename },
        {
            $set: {
                filename,
                originalName: opts.originalName || filename,
                contentType: opts.contentType || 'application/octet-stream',
                size: data.length,
                data,
                fileType: opts.fileType || 'document',
                hash: crypto.createHash('md5').update(data).digest('hex'),
                uploadedBy: opts.uploadedBy || undefined,
            },
        },
        { upsert: true, new: true }
    )
    return filename
}

/**
 * Add "Ken McCoy Consulting" / "KMC" watermark to a PDF resume.
 * - Bold, visible header & footer on every page
 * - Repeating diagonal "KMC" pattern across the entire page body (like the reference)
 * - Drawn directly into page content streams — cannot be removed by simple tools
 */
export async function addWatermarkToPdf(inputFilename: string): Promise<string> {
    const pdfBytes = await loadFileData(inputFilename)
    if (!pdfBytes) throw new Error('File not found: ' + inputFilename)

    const pdfDoc = await PDFDocument.load(pdfBytes)
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const lightFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const pages = pdfDoc.getPages()

    for (const page of pages) {
        const { width, height } = page.getSize()

        // ── HEADER BAR ──────────────────────────────────
        // Semi-transparent background strip at top
        page.drawRectangle({
            x: 0, y: height - 28, width, height: 28,
            color: rgb(0.95, 0.95, 0.97), opacity: 0.85,
        })
        page.drawText('Profile sourced by Ken McCoy Consulting', {
            x: 12, y: height - 20, size: 10, font,
            color: rgb(0.2, 0.2, 0.5),
        })
        // Right-aligned branding
        const rightText = 'kenmccoy.in'
        const rightWidth = lightFont.widthOfTextAtSize(rightText, 8)
        page.drawText(rightText, {
            x: width - rightWidth - 12, y: height - 19, size: 8, font: lightFont,
            color: rgb(0.4, 0.4, 0.6),
        })
        // Thin line under header
        page.drawLine({
            start: { x: 0, y: height - 28 },
            end: { x: width, y: height - 28 },
            thickness: 0.75, color: rgb(0.3, 0.3, 0.6), opacity: 0.5,
        })

        // ── FOOTER BAR ─────────────────────────────────
        page.drawRectangle({
            x: 0, y: 0, width, height: 22,
            color: rgb(0.95, 0.95, 0.97), opacity: 0.85,
        })
        page.drawText('Ken McCoy Consulting  |  kenmccoy.in  |  Confidential  |  Do not distribute without permission', {
            x: 12, y: 7, size: 7, font,
            color: rgb(0.3, 0.3, 0.5),
        })
        // Thin line above footer
        page.drawLine({
            start: { x: 0, y: 22 },
            end: { x: width, y: 22 },
            thickness: 0.75, color: rgb(0.3, 0.3, 0.6), opacity: 0.5,
        })

        // ── SINGLE LARGE DIAGONAL "KMC" WATERMARK ──────
        // One clean, big "KMC" centered on the page diagonal
        const wmText = 'KMC'
        const diagonal = Math.sqrt(width * width + height * height)
        const wmFontSize = Math.min(diagonal * 0.25, 220)
        const wmTextWidth = font.widthOfTextAtSize(wmText, wmFontSize)
        const wmTextHeight = wmFontSize * 0.72 // approx cap height
        const wmColor = rgb(0.78, 0.80, 0.86)

        const diagonalAngle = (Math.atan2(height, width) * 180) / Math.PI
        const rad = diagonalAngle * Math.PI / 180

        // Place at page center, then offset so the text's midpoint aligns with center
        const cx = width / 2
        const cy = height / 2
        const halfW = wmTextWidth / 2
        const halfH = wmTextHeight / 2
        // Unrotated text origin is bottom-left; shift left by half width and down by half height
        const x = cx - halfW * Math.cos(rad) + halfH * Math.sin(rad)
        const y = cy - halfW * Math.sin(rad) - halfH * Math.cos(rad)

        page.drawText(wmText, {
            x, y,
            size: wmFontSize, font,
            color: wmColor,
            rotate: { type: 'degrees' as any, angle: diagonalAngle },
            opacity: 0.15,
        })
    }

    const outputFilename = `wm_${inputFilename}`
    const modifiedPdfBytes = await pdfDoc.save()
    await saveFileData(outputFilename, Buffer.from(modifiedPdfBytes), {
        originalName: `watermarked_${inputFilename}`,
        contentType: 'application/pdf',
    })

    return outputFilename
}

/**
 * Remove PII (email addresses, phone numbers) from PDF.
 * Strategy: extract text → redact PII → rebuild a clean PDF from the redacted text.
 * (pdf-lib cannot edit existing text streams, so we must recreate the document.)
 */
export async function removePiiFromPdf(inputFilename: string): Promise<string> {
    const pdfBytes = await loadFileData(inputFilename)
    if (!pdfBytes) throw new Error('File not found: ' + inputFilename)

    // 1. Extract raw text from the original PDF
    const pdfParse = require('pdf-parse')
    const parsed = await pdfParse(pdfBytes)
    let text: string = parsed.text || ''

    // 2. Redact PII patterns
    // Email addresses
    text = text.replace(/[\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]')
    // Indian mobile: 10 digits starting with 6-9, with optional +91/0 prefix
    text = text.replace(/(?:\+?91[\s.\-]?)?0?[6-9]\d{4}[\s.\-]?\d{5}/g, '[PHONE REDACTED]')
    // International phone: +XX-XXXX-XXXXXX style
    text = text.replace(/\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{0,4}/g, '[PHONE REDACTED]')
    // Standalone 10-digit numbers that look like phone numbers
    text = text.replace(/\b[6-9]\d{9}\b/g, '[PHONE REDACTED]')
    // LinkedIn / GitHub URLs (often PII-adjacent)
    text = text.replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w\-]+/gi, '[LINKEDIN REDACTED]')
    text = text.replace(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w\-]+/gi, '[GITHUB REDACTED]')
    // Clean up multiple consecutive redaction tags on the same line
    text = text.replace(/(\[(?:PHONE|EMAIL) REDACTED\]\s*\|\s*)+\[(?:PHONE|EMAIL) REDACTED\]/g, '[CONTACT DETAILS REDACTED]')

    // 3. Rebuild a clean PDF from redacted text
    const newPdf = await PDFDocument.create()
    const font = await newPdf.embedFont(StandardFonts.Helvetica)
    const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold)
    const fontSize = 10
    const lineHeight = 14
    const margin = 50
    const pageWidth = 595
    const pageHeight = 842
    const maxWidth = pageWidth - margin * 2

    const lines = text.split('\n')
    let currentPage = newPdf.addPage([pageWidth, pageHeight])
    let yPos = pageHeight - margin

    // Header on first page
    currentPage.drawText('[PII Redacted Version — Contact details removed]', {
        x: margin, y: pageHeight - 25, size: 8, font: boldFont, color: rgb(0.8, 0.2, 0.2),
    })
    yPos -= 20

    for (const line of lines) {
        if (yPos < margin + 30) {
            // Footer
            currentPage.drawText('Ken McCoy Consulting — PII Redacted', {
                x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
            })
            currentPage = newPdf.addPage([pageWidth, pageHeight])
            yPos = pageHeight - margin
        }

        // Word-wrap
        const words = line.split(' ')
        let currentLine = ''
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            const w = font.widthOfTextAtSize(testLine, fontSize)
            if (w > maxWidth && currentLine) {
                // Check if line contains redacted markers — render in red
                const isRedacted = currentLine.includes('[') && currentLine.includes('REDACTED]')
                currentPage.drawText(currentLine, {
                    x: margin, y: yPos, size: fontSize, font,
                    color: isRedacted ? rgb(0.7, 0.15, 0.15) : rgb(0, 0, 0),
                })
                yPos -= lineHeight
                currentLine = word
                if (yPos < margin + 30) {
                    currentPage.drawText('Ken McCoy Consulting — PII Redacted', {
                        x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
                    })
                    currentPage = newPdf.addPage([pageWidth, pageHeight])
                    yPos = pageHeight - margin
                }
            } else {
                currentLine = testLine
            }
        }
        if (currentLine) {
            const isRedacted = currentLine.includes('[') && currentLine.includes('REDACTED]')
            currentPage.drawText(currentLine, {
                x: margin, y: yPos, size: fontSize, font,
                color: isRedacted ? rgb(0.7, 0.15, 0.15) : rgb(0, 0, 0),
            })
            yPos -= lineHeight
        } else {
            yPos -= lineHeight / 2
        }
    }

    // Footer on last page
    currentPage.drawText('Ken McCoy Consulting — PII Redacted', {
        x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    })

    const outputFilename = `redacted_${inputFilename}`
    const newPdfBytes = Buffer.from(await newPdf.save())
    await saveFileData(outputFilename, newPdfBytes, {
        originalName: `redacted_${inputFilename}`,
        contentType: 'application/pdf',
    })

    return outputFilename
}

/**
 * Remove PII from raw text
 */
export function removePiiFromText(text: string): string {
    let redacted = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL REDACTED]')
    redacted = redacted.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE REDACTED]')
    redacted = redacted.replace(/\b[6-9]\d{9}\b/g, '[PHONE REDACTED]')
    return redacted
}

/**
 * Remove CTC/compensation related text from JD text
 */
export function removeCTCFromText(text: string): string {
    const lines = text.split('\n')
    const filtered = lines.filter(line => {
        const lower = line.toLowerCase()
        return !(
            lower.includes('ctc') ||
            lower.includes('salary') ||
            lower.includes('compensation') ||
            lower.includes('budget') ||
            lower.includes('package') ||
            /\b\d+\s*(lpa|lakhs?|lacs?|crore|cr)\b/i.test(line) ||
            /\b(inr|₹|rs\.?)\s*\d/i.test(line)
        )
    })
    return filtered.join('\n')
}

/**
 * Convert PDF to DOCX — in memory via MongoDB
 */
export async function convertPdfToDocx(inputFilename: string): Promise<string> {
    const buffer = await loadFileData(inputFilename)
    if (!buffer) throw new Error('File not found: ' + inputFilename)

    const pdfParse = require('pdf-parse')
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text

    const { Document, Packer, Paragraph, TextRun, Header, Footer } = require('docx')

    const paragraphs = text.split('\n').filter((l: string) => l.trim()).map((line: string) =>
        new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 120 },
        })
    )

    const doc = new Document({
        sections: [{
            headers: {
                default: new Header({
                    children: [new Paragraph({
                        children: [new TextRun({ text: 'Profile sourced by Ken McCoy Consulting', size: 16, color: '666699' })],
                    })],
                }),
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        children: [new TextRun({ text: 'Ken McCoy Consulting', size: 14, color: '999999' })],
                    })],
                }),
            },
            children: paragraphs,
        }],
    })

    const outputFilename = `converted_${inputFilename.replace(/\.pdf$/i, '.docx')}`
    const docBuffer = await Packer.toBuffer(doc)
    await saveFileData(outputFilename, docBuffer, {
        originalName: inputFilename.replace(/\.pdf$/i, '.docx'),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    return outputFilename
}

/**
 * Convert DOCX to PDF — in memory via MongoDB
 */
export async function convertDocxToPdf(inputFilename: string): Promise<string> {
    const buffer = await loadFileData(inputFilename)
    if (!buffer) throw new Error('File not found: ' + inputFilename)

    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    const text: string = result.value

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontSize = 10
    const lineHeight = 14
    const margin = 50
    const pageWidth = 595
    const pageHeight = 842
    const maxWidth = pageWidth - margin * 2

    const lines = text.split('\n')
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
    let yPos = pageHeight - margin

    currentPage.drawText('Profile sourced by Ken McCoy Consulting', {
        x: margin, y: pageHeight - 25, size: 8, font: boldFont, color: rgb(0.3, 0.3, 0.6),
    })
    yPos -= 20

    for (const line of lines) {
        if (yPos < margin + 30) {
            currentPage.drawText('Ken McCoy Consulting', {
                x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
            })
            currentPage = pdfDoc.addPage([pageWidth, pageHeight])
            yPos = pageHeight - margin
        }

        const words = line.split(' ')
        let currentLine = ''
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            const width = font.widthOfTextAtSize(testLine, fontSize)
            if (width > maxWidth && currentLine) {
                currentPage.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
                yPos -= lineHeight
                currentLine = word
                if (yPos < margin + 30) {
                    currentPage.drawText('Ken McCoy Consulting', {
                        x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
                    })
                    currentPage = pdfDoc.addPage([pageWidth, pageHeight])
                    yPos = pageHeight - margin
                }
            } else {
                currentLine = testLine
            }
        }
        if (currentLine) {
            currentPage.drawText(currentLine, { x: margin, y: yPos, size: fontSize, font })
            yPos -= lineHeight
        } else {
            yPos -= lineHeight / 2
        }
    }

    currentPage.drawText('Ken McCoy Consulting', {
        x: margin, y: 15, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    })

    const outputFilename = `converted_${inputFilename.replace(/\.docx?$/i, '.pdf')}`
    const pdfBuf = Buffer.from(await pdfDoc.save())
    await saveFileData(outputFilename, pdfBuf, {
        originalName: inputFilename.replace(/\.docx?$/i, '.pdf'),
        contentType: 'application/pdf',
    })

    return outputFilename
}
