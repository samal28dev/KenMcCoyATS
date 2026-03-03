import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import ResumeParser from '@/lib/resume-parser'
import dbConnect from '@/lib/db'
import Candidate from '@/models/Candidate'
import crypto from 'crypto'

/**
 * Compute a SHA-256 hash from resume text for duplicate detection.
 * Normalizes whitespace + lowercases before hashing.
 */
function computeResumeHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    let resumeText = ''

    // Extract text based on file type
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.txt')) {
      resumeText = await file.text()
    } else if (fileName.endsWith('.pdf')) {
      try {
        const pdf = require('pdf-parse')
        const buffer = await file.arrayBuffer()
        const data = await pdf(Buffer.from(buffer))
        resumeText = data.text
      } catch (error) {
        console.error('PDF parsing error:', error)
        return NextResponse.json(
          { error: 'Failed to parse PDF file. Please try a text file instead.' },
          { status: 500 }
        )
      }
    } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      try {
        const mammoth = require('mammoth')
        const buffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
        resumeText = result.value
        if (!resumeText || resumeText.trim().length === 0) {
          return NextResponse.json(
            { error: 'Could not extract text from Word document. The file may be empty or corrupted.' },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('DOCX parsing error:', error)
        return NextResponse.json(
          { error: 'Failed to parse Word document. Please try a PDF or text file.' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, DOC, DOCX, or TXT file.' },
        { status: 400 }
      )
    }

    // ── Duplicate resume detection via hash + word-count comparison ──
    const resumeHash = computeResumeHash(resumeText)
    const wordCount = resumeText.split(/\s+/).filter(Boolean).length
    let duplicateInfo: { isDuplicate: boolean; existingId?: string; existingName?: string; overwritten?: boolean } = { isDuplicate: false }

    await dbConnect()
    const existingByHash = await Candidate.findOne({ resumeHash }).lean() as any

    if (existingByHash) {
      const daysSinceLastParse = existingByHash.lastParsedAt
        ? (Date.now() - new Date(existingByHash.lastParsedAt).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity

      if (daysSinceLastParse > 30) {
        // Old resume (>30 days) — flag it for overwrite; the new parse is considered more recent
        duplicateInfo = {
          isDuplicate: true,
          existingId: existingByHash._id.toString(),
          existingName: existingByHash.name,
          overwritten: true,
        }
      } else {
        // Word-count heuristic: if the new resume has significantly more words it's likely updated
        const existingWordCount = existingByHash.resumeWordCount || 0
        const isSignificantlyDifferent = existingWordCount > 0 && Math.abs(wordCount - existingWordCount) / existingWordCount > 0.15

        if (isSignificantlyDifferent) {
          duplicateInfo = {
            isDuplicate: true,
            existingId: existingByHash._id.toString(),
            existingName: existingByHash.name,
            overwritten: true,
          }
        } else {
          // Exact or near-identical duplicate within 30 days — warn, don't overwrite
          duplicateInfo = {
            isDuplicate: true,
            existingId: existingByHash._id.toString(),
            existingName: existingByHash.name,
            overwritten: false,
          }
        }
      }
    }

    // Parse the resume
    const parser = new ResumeParser(process.env.OPENAI_API_KEY)
    const parsedResume = await parser.parseResume(resumeText)

    return NextResponse.json({
      success: true,
      data: parsedResume,
      resumeHash,
      resumeWordCount: wordCount,
      duplicate: duplicateInfo,
      rawText: `${resumeText.substring(0, 500)}...`, // Include preview of raw text
    })
  } catch (error) {
    console.error('Resume parsing error:', error)
    return NextResponse.json(
      {
        error: 'Failed to parse resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Helper endpoint to check if OpenAI is configured
export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY
  return NextResponse.json({
    aiEnabled: hasOpenAI,
    message: hasOpenAI
      ? 'AI resume parsing is enabled'
      : 'AI parsing not configured. Using basic parser. Add OPENAI_API_KEY to enable AI parsing.',
  })
}
