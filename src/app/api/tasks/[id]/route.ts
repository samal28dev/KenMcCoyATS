import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Task from '@/models/Task'
import { emitRealtimeEvent } from '@/lib/socket'
import { logActivity } from '@/lib/activity-feed'

// GET /api/tasks/[id] — get single task
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params

        const task = await Task.findById(id)
            .populate('assigneeId', 'name email role')
            .populate('creatorId', 'name email')
            .lean()

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        return NextResponse.json(task)
    } catch (error) {
        console.error('Task get error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/tasks/[id] — update task
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()
        const { id } = await params
        const body = await request.json()

        // If closing, set completedAt
        const updates: any = { ...body }
        if (body.status === 'closed' && !body.completedAt) {
            updates.completedAt = new Date()
        }

        const task = await Task.findByIdAndUpdate(id, updates, { new: true })
            .populate('assigneeId', 'name email role')
            .populate('creatorId', 'name email')
            .lean()

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        emitRealtimeEvent('task:updated', { taskId: id, status: (task as any).status })

        if ((task as any).status === 'closed') {
            await logActivity({
                actorId: user._id.toString(),
                actorName: user.name || 'User',
                action: 'task_completed',
                targetType: 'task',
                targetId: id,
                targetName: (task as any).title,
            })
        }

        return NextResponse.json(task)
    } catch (error) {
        console.error('Task update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/tasks/[id] — delete task
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only super_admin, operations_head, or the task creator can delete
        await dbConnect()
        const { id } = await params

        const task = await Task.findById(id).lean() as any
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

        const isOwner = task.createdBy?.toString() === user._id.toString()
        const isAdmin = ['super_admin', 'operations_head'].includes(user.role)
        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        await Task.findByIdAndDelete(id)

        emitRealtimeEvent('task:updated', { taskId: id, action: 'deleted' })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Task delete error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
