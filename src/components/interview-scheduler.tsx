'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Calendar,
    Clock,
    MapPin,
    Plus,
    Users,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-picker'

interface Interview {
    _id: string
    candidateId: { _id: string; name: string; email: string; phone?: string } | null
    positionId: { _id: string; title: string } | null
    clientId: { _id: string; companyName: string } | null
    type: string
    date: string
    time: string
    duration?: string
    interviewers: string[]
    location?: string
    status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
    feedback?: string
    rating?: number
    recommendation?: 'proceed' | 'hold' | 'reject' | 'strong_hire'
    createdAt: string
}

interface InterviewSchedulerProps {
    candidateId: string
    candidateName: string
    positionId?: string
    clientId?: string
}

const INTERVIEW_TYPES = ['L1', 'L2', 'L3', 'HR', 'Technical', 'Managerial', 'Final']

const STATUS_COLORS: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'no-show': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
}

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
    strong_hire: { label: 'Strong Hire', color: 'text-green-600' },
    proceed: { label: 'Proceed', color: 'text-blue-600' },
    hold: { label: 'Hold', color: 'text-yellow-600' },
    reject: { label: 'Reject', color: 'text-red-600' },
}

async function fetchInterviews(candidateId: string): Promise<Interview[]> {
    const res = await apiFetch(`/api/interviews?candidateId=${candidateId}`)
    if (!res.ok) throw new Error('Failed to fetch interviews')
    return res.json()
}

export function InterviewScheduler({
    candidateId,
    candidateName,
    positionId,
    clientId,
}: InterviewSchedulerProps) {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [feedbackId, setFeedbackId] = useState<string | null>(null)

    const [form, setForm] = useState({
        type: 'L1',
        date: '',
        time: '',
        duration: '60 min',
        location: '',
        interviewers: '',
    })

    const [feedbackForm, setFeedbackForm] = useState({
        status: 'completed' as string,
        feedback: '',
        rating: 0,
        recommendation: '' as string,
    })

    const { data: interviews = [], isLoading } = useQuery({
        queryKey: ['interviews', candidateId],
        queryFn: () => fetchInterviews(candidateId),
        enabled: !!candidateId,
    })

    const scheduleMut = useMutation({
        mutationFn: async (data: Record<string, unknown>) => {
            const res = await apiFetch('/api/interviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                throw new Error(err?.error || 'Failed to schedule')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interviews', candidateId] })
            setShowForm(false)
            setForm({ type: 'L1', date: '', time: '', duration: '60 min', location: '', interviewers: '' })
            toast.success('Interview scheduled')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const updateMut = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
            const res = await apiFetch(`/api/interviews/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => null)
                throw new Error(err?.error || 'Failed to update')
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interviews', candidateId] })
            setFeedbackId(null)
            setFeedbackForm({ status: 'completed', feedback: '', rating: 0, recommendation: '' })
            toast.success('Interview updated')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const cancelMut = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiFetch(`/api/interviews/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to cancel')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['interviews', candidateId] })
            toast.success('Interview cancelled')
        },
    })

    const handleSchedule = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.date || !form.time || !form.type) {
            toast.error('Please fill date, time and type')
            return
        }
        scheduleMut.mutate({
            candidateId,
            positionId,
            clientId,
            type: form.type,
            date: form.date,
            time: form.time,
            duration: form.duration,
            location: form.location,
            interviewers: form.interviewers.split(',').map(s => s.trim()).filter(Boolean),
        })
    }

    const handleFeedback = (id: string) => {
        updateMut.mutate({
            id,
            data: {
                status: feedbackForm.status,
                feedback: feedbackForm.feedback,
                rating: feedbackForm.rating || undefined,
                recommendation: feedbackForm.recommendation || undefined,
            },
        })
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Interviews ({interviews.length})
                </h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    <Plus className="h-3 w-3" />
                    Schedule
                </button>
            </div>

            {/* Schedule Form */}
            {showForm && (
                <form onSubmit={handleSchedule} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type *</label>
                            <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {INTERVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Duration</label>
                            <Select value={form.duration} onValueChange={(val) => setForm({ ...form, duration: val })}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30 min">30 min</SelectItem>
                                    <SelectItem value="45 min">45 min</SelectItem>
                                    <SelectItem value="60 min">60 min</SelectItem>
                                    <SelectItem value="90 min">90 min</SelectItem>
                                    <SelectItem value="120 min">120 min</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date *</label>
                            <DateInput value={form.date} onChange={(val) => setForm({ ...form, date: val })} placeholder="Interview date" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Time *</label>
                            <input
                                type="time"
                                value={form.time}
                                onChange={e => setForm({ ...form, time: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
                            <input
                                type="text"
                                value={form.location}
                                placeholder="Office / Google Meet link"
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Interviewers</label>
                            <input
                                type="text"
                                value={form.interviewers}
                                placeholder="Name 1, Name 2"
                                onChange={e => setForm({ ...form, interviewers: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={scheduleMut.isPending}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {scheduleMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Schedule Interview'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Interview List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                    <div className="p-4 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                ) : interviews.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        No interviews scheduled yet
                    </div>
                ) : (
                    interviews.map((interview) => (
                        <div key={interview._id} className="p-3">
                            {/* Interview Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[interview.status]}`}>
                                        {interview.type}
                                    </span>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(interview.date).toLocaleDateString()}
                                        <Clock className="h-3.5 w-3.5 ml-1" />
                                        {interview.time}
                                        {interview.duration && (
                                            <span className="text-xs text-gray-400">({interview.duration})</span>
                                        )}
                                    </div>
                                    {interview.location && (
                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                            <MapPin className="h-3 w-3" />
                                            {interview.location}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[interview.status]}`}>
                                        {interview.status}
                                    </span>
                                    {interview.recommendation && (
                                        <span className={`text-xs font-medium ${RECOMMENDATION_LABELS[interview.recommendation]?.color || ''}`}>
                                            {RECOMMENDATION_LABELS[interview.recommendation]?.label || interview.recommendation}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setExpandedId(expandedId === interview._id ? null : interview._id)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        {expandedId === interview._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedId === interview._id && (
                                <div className="mt-3 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-2">
                                    {interview.interviewers.length > 0 && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            Interviewers: {interview.interviewers.join(', ')}
                                        </p>
                                    )}
                                    {interview.feedback && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                            <MessageSquare className="h-3 w-3 mt-0.5" />
                                            {interview.feedback}
                                        </p>
                                    )}
                                    {interview.rating != null && interview.rating > 0 && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <Star className="h-3 w-3" />
                                            Rating: {interview.rating}/5
                                        </p>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-1">
                                        {interview.status === 'scheduled' && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setFeedbackId(interview._id)
                                                        setFeedbackForm({ status: 'completed', feedback: '', rating: 0, recommendation: '' })
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded hover:bg-green-100"
                                                >
                                                    <CheckCircle className="h-3 w-3" /> Complete
                                                </button>
                                                <button
                                                    onClick={() => cancelMut.mutate(interview._id)}
                                                    disabled={cancelMut.isPending}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100"
                                                >
                                                    <XCircle className="h-3 w-3" /> Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setFeedbackId(interview._id)
                                                        setFeedbackForm({ status: 'no-show', feedback: 'Candidate did not attend', rating: 0, recommendation: '' })
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded hover:bg-yellow-100"
                                                >
                                                    <AlertCircle className="h-3 w-3" /> No-Show
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Feedback Form */}
                                    {feedbackId === interview._id && (
                                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                                                    <Select value={feedbackForm.status} onValueChange={(val) => setFeedbackForm({ ...feedbackForm, status: val })}>
                                                        <SelectTrigger className="w-full h-7 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="completed">Completed</SelectItem>
                                                            <SelectItem value="no-show">No-Show</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Recommendation</label>
                                                    <Select value={feedbackForm.recommendation || 'none'} onValueChange={(val) => setFeedbackForm({ ...feedbackForm, recommendation: val === 'none' ? '' : val })}>
                                                        <SelectTrigger className="w-full h-7 text-xs">
                                                            <SelectValue placeholder="Select..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Select...</SelectItem>
                                                            <SelectItem value="strong_hire">Strong Hire</SelectItem>
                                                            <SelectItem value="proceed">Proceed</SelectItem>
                                                            <SelectItem value="hold">Hold</SelectItem>
                                                            <SelectItem value="reject">Reject</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rating (1-5)</label>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <button
                                                            key={n}
                                                            type="button"
                                                            onClick={() => setFeedbackForm({ ...feedbackForm, rating: n })}
                                                            className={`p-1 ${n <= feedbackForm.rating ? 'text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
                                                        >
                                                            <Star className="h-4 w-4" fill={n <= feedbackForm.rating ? 'currentColor' : 'none'} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Feedback</label>
                                                <textarea
                                                    rows={2}
                                                    value={feedbackForm.feedback}
                                                    onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                                    placeholder="Interview feedback..."
                                                    className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleFeedback(interview._id)}
                                                    disabled={updateMut.isPending}
                                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    {updateMut.isPending ? 'Saving...' : 'Save Feedback'}
                                                </button>
                                                <button
                                                    onClick={() => setFeedbackId(null)}
                                                    className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
