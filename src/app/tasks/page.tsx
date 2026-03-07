'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/providers/auth-provider'
import { AppShell } from '@/components/layout/app-shell'
import {
    Plus,
    CheckSquare,
    Clock,
    AlertCircle,
    Pause,
    Calendar,
    User,
    Filter,
} from 'lucide-react'
import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-picker'
import { toast } from 'sonner'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckSquare }> = {
    new: { label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: AlertCircle },
    'in-process': { label: 'In Process', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
    hold: { label: 'On Hold', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300', icon: Pause },
    closed: { label: 'Closed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckSquare },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    low: { label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
}

export default function TasksPage() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState('all')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [selectedTask, setSelectedTask] = useState<any>(null)

    // Form state
    const [form, setForm] = useState({
        title: '', description: '', type: 'custom', assigneeId: '',
        priority: 'medium', dueDate: '', relatedType: '', relatedId: ''
    })

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['tasks', statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (statusFilter !== 'all') params.set('status', statusFilter)
            const res = await apiFetch(`/api/tasks?${params}`)
            return res.json()
        },
    })

    const { data: teamMembers = [] } = useQuery({
        queryKey: ['team'],
        queryFn: async () => { const res = await apiFetch('/api/teams'); return res.json() },
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiFetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error('Failed to create task')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            setShowCreateModal(false)
            setForm({ title: '', description: '', type: 'custom', assigneeId: '', priority: 'medium', dueDate: '', relatedType: '', relatedId: '' })
        },
    })

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const res = await apiFetch(`/api/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error('Failed to update task')
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate({
            ...form,
            relatedTo: form.relatedType ? { type: form.relatedType, id: form.relatedId } : undefined,
        })
    }

    const handleMarkDone = async (task: any) => {
        try {
            await updateStatusMutation.mutateAsync({ id: task._id, status: 'closed' })
            toast.success(`Done button clicked by ${user?.name || 'User'}`)
            setSelectedTask(null)
        } catch (error) {
            toast.error('Failed to mark task as done')
        }
    }

    const isOverdue = (dueDate: string) => new Date(dueDate) < new Date()

    return (
        <AppShell>
            <div className="section-padding py-8 border-b border-border/50">
                <div className="container-max flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Tasks & Reminders</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your tasks and follow-ups
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary inline-flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> New Task
                    </button>
                </div>
            </div>

            <div className="section-padding py-6">
                <div className="container-max">
                    {/* Filters */}
                    <div className="flex items-center gap-2 mb-6">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        {['all', 'new', 'in-process', 'hold', 'closed'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
                            </button>
                        ))}
                    </div>

                    {/* Task List */}
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="card-clean animate-pulse p-4">
                                    <div className="h-4 w-1/3 bg-muted rounded mb-2" />
                                    <div className="h-3 w-2/3 bg-muted/70 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="card-clean p-12 text-center">
                            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">No tasks found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task: any) => {
                                const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.new
                                const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                                const StatusIcon = statusCfg.icon
                                const overdue = task.status !== 'closed' && isOverdue(task.dueDate)

                                return (
                                    <div
                                        key={task._id}
                                        onClick={() => setSelectedTask(task)}
                                        className={`card-clean p-4 border-l-4 cursor-pointer hover:bg-muted/30 transition-colors ${overdue ? 'border-l-red-500' : 'border-l-transparent'}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <StatusIcon className="h-4 w-4 shrink-0" />
                                                    <h3 className="font-medium truncate">{task.title}</h3>
                                                </div>
                                                {task.description && (
                                                    <p className="text-sm text-muted-foreground line-clamp-1 ml-6">{task.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 ml-6 text-xs text-muted-foreground">
                                                    <span className={`px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                                                        {statusCfg.label}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full font-medium ${priorityCfg.color}`}>
                                                        {priorityCfg.label}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {overdue ? (
                                                            <span className="text-red-500 font-medium">
                                                                Overdue by {formatDistanceToNow(new Date(task.dueDate))}
                                                            </span>
                                                        ) : (
                                                            `Due ${formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}`
                                                        )}
                                                    </span>
                                                    {task.assigneeId && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {task.assigneeId.name || 'Unassigned'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Quick status change */}
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Select value={task.status} onValueChange={(val) => updateStatusMutation.mutate({ id: task._id, status: val })}>
                                                    <SelectTrigger className="w-[120px] h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="new">New</SelectItem>
                                                        <SelectItem value="in-process">In Process</SelectItem>
                                                        <SelectItem value="hold">Hold</SelectItem>
                                                        <SelectItem value="closed">Closed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Task Detail Modal */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTask(null)}>
                    <div className="bg-background rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        {(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.new).icon && React.createElement((STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.new).icon, { className: "h-5 w-5 text-primary" })}
                                        <h2 className="text-xl font-semibold break-words">{selectedTask.title}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.new).color}`}>
                                            {(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.new).label}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(PRIORITY_CONFIG[selectedTask.priority] || PRIORITY_CONFIG.medium).color}`}>
                                            {(PRIORITY_CONFIG[selectedTask.priority] || PRIORITY_CONFIG.medium).label}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground uppercase">
                                            {selectedTask.type?.replace(/_/g, ' ') || 'Custom'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="p-2 hover:bg-muted rounded-full transition-colors"
                                >
                                    <Plus className="h-5 w-5 rotate-45" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Due Date</p>
                                            <p className="font-medium">
                                                {formatDistanceToNow(new Date(selectedTask.dueDate), { addSuffix: true })}
                                                {isOverdue(selectedTask.dueDate) && selectedTask.status !== 'closed' && (
                                                    <span className="ml-2 text-red-500 text-xs font-bold">(Overdue)</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Assigned To</p>
                                            <p className="font-medium">{selectedTask.assigneeId?.name || 'Unassigned'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Created</p>
                                            <p className="font-medium text-muted-foreground">
                                                {selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
                                <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px]">
                                    {selectedTask.description || <span className="italic text-muted-foreground">No description provided</span>}
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                {selectedTask.status !== 'closed' && (
                                    <button
                                        onClick={() => handleMarkDone(selectedTask)}
                                        className="btn-primary px-6"
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        {updateStatusMutation.isPending ? 'Marking...' : 'Done'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="btn-secondary px-6"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Task Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background rounded-xl shadow-xl w-full max-w-lg p-6 m-4">
                        <h2 className="text-lg font-semibold mb-4">Create New Task</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Title *</label>
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="input-clean mt-1" required />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="input-clean mt-1" rows={3} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Assign To *</label>
                                    <Select value={form.assigneeId} onValueChange={(val) => setForm({ ...form, assigneeId: val })}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teamMembers.map((m: any) => (
                                                <SelectItem key={m._id} value={m._id}>{m.name} ({m.role})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Due Date *</label>
                                    <div className="mt-1">
                                        <DateInput value={form.dueDate} onChange={(val) => setForm({ ...form, dueDate: val })} placeholder="Select due date" required />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Priority</label>
                                    <Select value={form.priority} onValueChange={(val) => setForm({ ...form, priority: val })}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                                    <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="custom">Custom</SelectItem>
                                            <SelectItem value="call">Call</SelectItem>
                                            <SelectItem value="follow_up">Follow Up</SelectItem>
                                            <SelectItem value="interview_schedule">Interview Schedule</SelectItem>
                                            <SelectItem value="document_collection">Document Collection</SelectItem>
                                            <SelectItem value="offer_release">Offer Release</SelectItem>
                                            <SelectItem value="joining_confirmation">Joining Confirmation</SelectItem>
                                            <SelectItem value="agreement_renewal">Agreement Renewal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary"
                                    disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    )
}
