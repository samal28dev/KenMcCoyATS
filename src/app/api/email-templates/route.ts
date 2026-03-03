import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import EmailTemplate from '@/models/EmailTemplate'
import { seedDefaultTemplates } from '@/lib/email-template-seeds'

// GET /api/email-templates — list all templates
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const category = searchParams.get('category')
        const type = searchParams.get('type')

        const filter: any = { isActive: true }
        if (category) filter.category = category
        if (type) filter.type = type

        let templates = await EmailTemplate.find(filter)
            .sort({ useCount: -1, updatedAt: -1 })
            .lean()

        // Auto-seed default templates if DB is empty
        if (templates.length === 0 && !category && !type) {
            await seedDefaultTemplates()
            templates = await EmailTemplate.find(filter)
                .sort({ useCount: -1, updatedAt: -1 })
                .lean()
        }

        return NextResponse.json(templates)
    } catch (error) {
        console.error('Email templates list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/email-templates — create template
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()

        const { name, category, type, subject, content, variables, tags } = body
        if (!name || !subject || !content) {
            return NextResponse.json({ error: 'Name, subject, and content are required' }, { status: 400 })
        }

        const template = await EmailTemplate.create({
            name,
            category: category || 'general',
            type: type || 'custom',
            subject,
            content,
            variables: variables || [],
            tags: tags || [],
        })

        return NextResponse.json(template, { status: 201 })
    } catch (error) {
        console.error('Email template create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/email-templates — update template
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { templateId, ...updates } = body

        if (!templateId) {
            return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
        }

        const template = await EmailTemplate.findByIdAndUpdate(templateId, updates, { new: true }).lean()
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        return NextResponse.json(template)
    } catch (error) {
        console.error('Email template update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/email-templates — soft delete
export async function DELETE(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const templateId = searchParams.get('id')

        if (!templateId) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        await EmailTemplate.findByIdAndUpdate(templateId, { isActive: false })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Email template delete error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
