'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, ArrowLeft, Users, FileText, Mail, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { CommentsWidget } from '@/components/comments-widget'
import { DocumentActions } from '@/components/document-actions'
import { EmailComposeModal } from '@/components/email-compose-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const PIPELINE_STAGES = [
    { value: 'submitted', label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
    { value: 'shortlisted', label: 'Shortlisted', color: 'bg-blue-100 text-blue-700' },
    { value: 'interview_l1', label: 'Interview L1', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'interview_l2', label: 'Interview L2', color: 'bg-purple-100 text-purple-700' },
    { value: 'interview_l3', label: 'Interview L3', color: 'bg-violet-100 text-violet-700' },
    { value: 'offered', label: 'Offered', color: 'bg-amber-100 text-amber-700' },
    { value: 'joined', label: 'Joined', color: 'bg-green-100 text-green-700' },
    { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
    { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-500' },
]

function getStageStyle(status: string) {
    return PIPELINE_STAGES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-700'
}

export default function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [emailOpen, setEmailOpen] = useState(false)
    const [assignOpen, setAssignOpen] = useState(false)
    const [selectedCandidateId, setSelectedCandidateId] = useState('')
    const queryClient = useQueryClient()

    const { data: position } = useQuery({
        queryKey: ['position', id],
        queryFn: async () => {
            const res = await apiFetch(`/api/positions/${id}`)
            return res.json()
        },
    })

    // Fetch all candidates for "Assign" dropdown
    const { data: allCandidates = [] } = useQuery({
        queryKey: ['candidates-list'],
        queryFn: async () => {
            const res = await apiFetch('/api/candidates?limit=500')
            const data = await res.json()
            return data.candidates || data  // API returns { candidates: [...] }
        },
        enabled: assignOpen,
    })

    // Assign candidate to this position
    const assignMutation = useMutation({
        mutationFn: async (candidateId: string) => {
            const res = await apiFetch('/api/candidate-positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId, positionId: id }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to assign')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Candidate assigned!')
            queryClient.invalidateQueries({ queryKey: ['position', id] })
            setAssignOpen(false)
            setSelectedCandidateId('')
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Update position status
    const positionStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            const res = await apiFetch(`/api/positions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update status')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Position status updated!')
            queryClient.invalidateQueries({ queryKey: ['position', id] })
            queryClient.invalidateQueries({ queryKey: ['positions'] })
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Update pipeline status
    const statusMutation = useMutation({
        mutationFn: async ({ cpId, status }: { cpId: string, status: string }) => {
            const res = await apiFetch('/api/candidate-positions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cpId, status }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Status updated!')
            queryClient.invalidateQueries({ queryKey: ['position', id] })
        },
        onError: (err: any) => toast.error(err.message),
    })

    if (!position) {
        return <AppShell><div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div></AppShell>
    }

    // Filter out already-assigned candidates
    const assignedCandidateIds = (position.candidatePositions || []).map((cp: any) => cp.candidateId?._id)
    const availableCandidates = allCandidates.filter((c: any) => !assignedCandidateIds.includes(c._id))

    // Count by stage
    const stageCounts: Record<string, number> = {}
        ; (position.candidatePositions || []).forEach((cp: any) => {
            stageCounts[cp.status] = (stageCounts[cp.status] || 0) + 1
        })

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto">
                        <Link href="/positions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
                            <ArrowLeft className="h-3 w-3" /> Back to Positions
                        </Link>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                    <Briefcase className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-semibold">{position.title}</h1>
                                    <p className="text-sm text-muted-foreground">{position.clientId?.companyName || 'No client'} · {position.status}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAssignOpen(!assignOpen)}
                                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-medium">
                                    <Plus className="h-3.5 w-3.5" /> Add Candidate
                                </button>
                                <button onClick={() => setEmailOpen(true)}
                                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" /> Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assign Candidate Panel */}
                {assignOpen && (
                    <div className="max-w-7xl mx-auto px-6 py-3">
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <h3 className="text-sm font-semibold mb-3">Add Candidate to Pipeline</h3>
                            <div className="flex items-center gap-3">
                                <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select a candidate..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCandidates.map((c: any) => (
                                            <SelectItem key={c._id} value={c._id}>
                                                {c.name} — {c.designation || c.email} ({c.experience || 'N/A'} exp)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <button
                                    onClick={() => selectedCandidateId && assignMutation.mutate(selectedCandidateId)}
                                    disabled={!selectedCandidateId || assignMutation.isPending}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {assignMutation.isPending ? 'Assigning...' : 'Add to Pipeline'}
                                </button>
                                <button onClick={() => setAssignOpen(false)}
                                    className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pipeline Overview Bar */}
                {(position.candidatePositions?.length || 0) > 0 && (
                    <div className="max-w-7xl mx-auto px-6 pt-4">
                        <div className="flex flex-wrap gap-2">
                            {PIPELINE_STAGES.slice(0, 7).map(stage => (
                                <div key={stage.value}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${stageCounts[stage.value] ? stage.color : 'bg-muted/30 text-muted-foreground'
                                        }`}>
                                    <span>{stage.label}</span>
                                    <span className="font-bold">{stageCounts[stage.value] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Candidates Pipeline */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Candidates Pipeline ({position.candidatePositions?.length || 0})
                            </h2>
                            {position.candidatePositions?.length > 0 ? (
                                <div className="space-y-3">
                                    {position.candidatePositions.map((cp: any) => (
                                        <div key={cp._id} className="rounded-lg border border-border p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Link href={`/candidates/${cp.candidateId?._id}`}>
                                                    <div className="hover:underline">
                                                        <p className="text-sm font-medium flex items-center gap-1">
                                                            {cp.candidateId?.name || 'Unknown'}
                                                            <ChevronRight className="h-3 w-3" />
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {cp.candidateId?.designation || cp.candidateId?.email}
                                                            {cp.candidateId?.currentCompany && ` · ${cp.candidateId.currentCompany}`}
                                                        </p>
                                                    </div>
                                                </Link>
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStageStyle(cp.status)}`}>
                                                    {cp.status?.replace(/_/g, ' ')}
                                                </span>
                                            </div>

                                            {/* Stage Buttons */}
                                            <div className="flex flex-wrap gap-1">
                                                {PIPELINE_STAGES.map(stage => (
                                                    <button
                                                        key={stage.value}
                                                        onClick={() => {
                                                            if (stage.value !== cp.status) {
                                                                statusMutation.mutate({ cpId: cp._id, status: stage.value })
                                                            }
                                                        }}
                                                        disabled={statusMutation.isPending}
                                                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-all ${stage.value === cp.status
                                                            ? `${stage.color} border-transparent font-semibold ring-1 ring-current`
                                                            : 'border-border text-muted-foreground hover:bg-muted'
                                                            }`}
                                                    >
                                                        {stage.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-muted-foreground mb-3">No candidates in pipeline yet</p>
                                    <button onClick={() => setAssignOpen(true)}
                                        className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                                        <Plus className="h-3.5 w-3.5 inline mr-1" /> Add First Candidate
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {position.description && (
                            <div className="rounded-xl border border-border bg-card p-5">
                                <h2 className="text-sm font-semibold mb-3">Description</h2>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{position.description}</p>
                            </div>
                        )}

                        {/* JD Document */}
                        {position.jdFile && (
                            <div className="rounded-xl border border-border bg-card p-5">
                                <h2 className="text-sm font-semibold mb-3">Job Description</h2>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span>{position.jdFilename || position.jdFile}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a href={`/api/files/download/${position.jdFile}`} target="_blank" rel="noopener"
                                            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors">Download</a>
                                        <DocumentActions filename={position.jdFile} type="jd" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comments */}
                        <CommentsWidget entityType="position" entityId={id} />
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-3">Details</h2>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Select value={position.status} onValueChange={(val) => positionStatusMutation.mutate(val)}>
                                        <SelectTrigger className="w-[160px] h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="new">New</SelectItem>
                                            <SelectItem value="work-in-progress">Work In Progress</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div><span className="text-muted-foreground">Assigned to:</span> <span className="font-medium">{position.assignedTo?.name || 'Unassigned'}</span></div>
                                <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{position.clientId?.companyName}</span></div>
                                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{new Date(position.createdAt).toLocaleDateString()}</span></div>
                            </div>
                        </div>

                        {position.requirements?.length > 0 && (
                            <div className="rounded-xl border border-border bg-card p-5">
                                <h2 className="text-sm font-semibold mb-3">Requirements</h2>
                                <ul className="space-y-1">
                                    {position.requirements.map((r: string, i: number) => (
                                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                            <span>•</span> {r}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            <EmailComposeModal
                isOpen={emailOpen}
                onClose={() => setEmailOpen(false)}
                defaultSubject={`Regarding Position: ${position.title}`}
                positionId={id}
                clientId={position.clientId?._id}
                jdFile={position.jdFile}
            />
        </AppShell>
    )
}
