import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Comment from '@/models/Comment'
import { notifyHierarchy, notifyUser } from '@/lib/notify'
import { emitRealtimeEvent } from '@/lib/socket'
import { logActivity } from '@/lib/activity-feed'

// GET /api/comments?entityType=candidate&entityId=xxx
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const entityType = searchParams.get('entityType')
        const entityId = searchParams.get('entityId')

        if (!entityType || !entityId) {
            return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
        }

        const comments = await Comment.find({ entityType, entityId, isDeleted: false })
            .populate('authorId', 'name email role')
            .populate('mentions', 'name email')
            .populate({
                path: 'parentId',
                populate: { path: 'authorId', select: 'name' },
            })
            .sort({ createdAt: -1 })
            .lean()

        return NextResponse.json(comments)
    } catch (error) {
        console.error('Comments list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/comments — create comment + auto-notify hierarchy
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { entityType, entityId, content, parentId, mentions } = body

        if (!entityType || !entityId || !content) {
            return NextResponse.json({ error: 'entityType, entityId, and content are required' }, { status: 400 })
        }

        const comment = await Comment.create({
            entityType,
            entityId,
            authorId: user._id,
            content: content.replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]+on\w+\s*=\s*["'][^"']*["']/gi, '').trim(),
            parentId: parentId || null,
            mentions: mentions || [],
        })

        const populated = await Comment.findById(comment._id)
            .populate('authorId', 'name email role')
            .populate('mentions', 'name email')
            .lean()

        // Auto-notify hierarchy on comment
        await notifyHierarchy({
            actorId: user._id,
            actorRole: user.role,
            actorName: 'Team Member',
            action: 'comment_added',
            entityType: entityType as 'candidate' | 'position' | 'client' | 'task',
            entityId,
            entityName: entityType,
            message: `New comment on ${entityType}: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
        })

        // Notify mentioned users directly
        if (mentions?.length) {
            for (const mentionId of mentions) {
                if (mentionId !== user._id.toString()) {
                    await notifyUser({
                        senderId: user._id,
                        recipientId: mentionId,
                        action: 'mention',
                        entityType: entityType as 'candidate' | 'position' | 'client' | 'task',
                        entityId,
                        title: 'You were mentioned in a comment',
                        message: `You were mentioned: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
                    })
                }
            }
        }

        emitRealtimeEvent('comment:created', {
            entityType,
            entityId,
            actorId: user._id.toString(),
        })

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'comment_added',
            targetType: entityType as 'candidate' | 'position' | 'client' | 'task',
            targetId: entityId,
            targetName: `${entityType} comment`,
        })

        return NextResponse.json(populated, { status: 201 })
    } catch (error) {
        console.error('Comment create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/comments — edit comment
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const body = await request.json()
        const { commentId, content } = body

        if (!commentId || !content) {
            return NextResponse.json({ error: 'commentId and content are required' }, { status: 400 })
        }

        const comment = await Comment.findById(commentId) as any
        if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        if (comment.authorId.toString() !== user._id.toString()) {
            return NextResponse.json({ error: 'Can only edit your own comments' }, { status: 403 })
        }

        comment.content = content
        comment.isEdited = true
        comment.editedAt = new Date()
        await comment.save()

        return NextResponse.json(comment)
    } catch (error) {
        console.error('Comment edit error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/comments — soft delete
export async function DELETE(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const commentId = searchParams.get('id')

        if (!commentId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const comment = await Comment.findById(commentId) as any
        if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

        // Authors can delete own, admins can delete any
        if (comment.authorId.toString() !== user._id.toString() && !['super_admin', 'operations_head'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        comment.isDeleted = true
        await comment.save()

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Comment delete error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
