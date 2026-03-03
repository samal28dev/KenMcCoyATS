import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import FileStore from '@/models/FileStore'
import path from 'path'
import fs from 'fs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storageId: string }> }
) {
  try {
    const user = await verifyAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { storageId } = await params
    await dbConnect()

    // Try MongoDB first
    const stored = await FileStore.findOne({ filename: storageId })
    if (stored) {
      return new NextResponse(stored.data, {
        status: 200,
        headers: {
          'Content-Type': stored.contentType || 'application/octet-stream',
          'Content-Length': stored.size.toString(),
          'Content-Disposition': `inline; filename="${stored.originalName}"`,
        },
      })
    }

    // Fallback to filesystem (for files uploaded before MongoDB migration)
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const filePath = path.join(uploadsDir, storageId)

    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath)
      const ext = path.extname(storageId).toLowerCase()

      const contentTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentTypes[ext] || 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString(),
          'Content-Disposition': `inline; filename="${storageId}"`,
        },
      })
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  } catch (error) {
    console.error('File download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
