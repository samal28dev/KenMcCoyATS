import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import Task from '@/models/Task'
import { emitRealtimeEvent } from '@/lib/socket'
import { notifyUser } from '@/lib/notify'
import { logActivity } from '@/lib/activity-feed'

// GET /api/tasks — list tasks
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const assignee = searchParams.get('assignee')
        const priority = searchParams.get('priority')
        const relatedType = searchParams.get('relatedType')
        const relatedId = searchParams.get('relatedId')

        const filter: any = {}

        if (status && status !== 'all') filter.status = status
        if (assignee) filter.assigneeId = assignee
        if (priority && priority !== 'all') filter.priority = priority
        if (relatedType) filter['relatedTo.type'] = relatedType
        if (relatedId) filter['relatedTo.id'] = relatedId

        const tasks = await Task.find(filter)
            .populate('assigneeId', 'name email role')
            .populate('creatorId', 'name email')
            .sort({ dueDate: 1, priority: -1 })
            .lean()

        return NextResponse.json(tasks)
    } catch (error) {
        console.error('Tasks list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/tasks — create task
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        await dbConnect()

        const body = await request.json()
        const { title, description, type, assigneeId, relatedTo, priority, dueDate } = body

        if (!title || !assigneeId || !dueDate) {
            return NextResponse.json(
                { error: 'Title, assignee, and due date are required' },
                { status: 400 }
            )
        }

        const task = await Task.create({
            title,
            description,
            type: type || 'custom',
            assigneeId,
            creatorId: user._id,
            relatedTo,
            priority: priority || 'medium',
            dueDate: new Date(dueDate),
            status: 'new'
        })

        const populated = await Task.findById(task._id)
            .populate('assigneeId', 'name email role')
            .populate('creatorId', 'name email')
            .lean()

        emitRealtimeEvent('task:created', {
            taskId: task._id.toString(),
            title: task.title,
            assigneeId: assigneeId,
            actorId: user._id.toString(),
        })

        // Notify the assigned user
        if (assigneeId && assigneeId !== user._id.toString()) {
            await notifyUser({
                senderId: user._id,
                recipientId: assigneeId,
                action: 'task_assigned',
                entityType: 'task',
                entityId: task._id.toString(),
                title: 'New Task Assigned',
                message: `You have been assigned a new task: "${task.title}"`,
            })
        }

        await logActivity({
            actorId: user._id.toString(),
            actorName: user.name || 'User',
            action: 'task_created',
            targetType: 'task',
            targetId: task._id.toString(),
            targetName: task.title,
        })

        return NextResponse.json(populated, { status: 201 })
    } catch (error) {
        console.error('Task create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
