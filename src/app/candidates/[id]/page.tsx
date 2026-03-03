'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, FileText, Lock, Unlock, Plus, ChevronRight, User } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { CommentsWidget } from '@/components/comments-widget'
import { EmailComposeModal } from '@/components/email-compose-modal'
import { DocumentActions } from '@/components/document-actions'
import { InterviewScheduler } from '@/components/interview-scheduler'
import { toast } from 'sonner'
import { useAuth } from '@/providers/auth-provider'

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

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [emailOpen, setEmailOpen] = useState(false)
    const [assignOpen, setAssignOpen] = useState(false)
    const [selectedPositionId, setSelectedPositionId] = useState('')
    const queryClient = useQueryClient()
    const { user: currentUser } = useAuth()
    const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'operations_head'

    const { data: candidate } = useQuery({
        queryKey: ['candidate', id],
        queryFn: async () => {
            const res = await apiFetch(`/api/candidates/${id}`)
            return res.json()
        },
    })

    // Fetch all open positions for the "Assign" dropdown
    const { data: allPositions = [] } = useQuery({
        queryKey: ['positions-list'],
        queryFn: async () => {
            const res = await apiFetch('/api/positions')
            return res.json()
        },
        enabled: assignOpen,
    })

    // Assign candidate to position
    const assignMutation = useMutation({
        mutationFn: async (positionId: string) => {
            const res = await apiFetch('/api/candidate-positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateId: id, positionId }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to assign')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Candidate assigned to position!')
            queryClient.invalidateQueries({ queryKey: ['candidate', id] })
            setAssignOpen(false)
            setSelectedPositionId('')
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Update pipeline status
    const statusMutation = useMutation({
        mutationFn: async ({ cpId, status, remarks }: { cpId: string, status: string, remarks?: string }) => {
            const res = await apiFetch('/api/candidate-positions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cpId, status, remarks }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to update')
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success('Pipeline status updated!')
            queryClient.invalidateQueries({ queryKey: ['candidate', id] })
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Admin lock/unlock mutation
    const lockMutation = useMutation({
        mutationFn: async (lock: boolean) => {
            const res = await apiFetch(`/api/candidates/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toggleLock: lock }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.message || 'Failed')
            }
            return res.json()
        },
        onSuccess: (_, lock) => {
            toast.success(lock ? 'Candidate locked' : 'Candidate unlocked')
            queryClient.invalidateQueries({ queryKey: ['candidate', id] })
        },
        onError: (err: any) => toast.error(err.message),
    })

    if (!candidate) {
        return <AppShell><div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div></AppShell>
    }

    // Filter out positions already assigned
    const assignedPositionIds = (candidate.positions || []).map((cp: any) => cp.positionId?._id)
    const availablePositions = allPositions.filter((p: any) => !assignedPositionIds.includes(p._id))

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto">
                        <Link href="/candidates" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
                            <ArrowLeft className="h-3 w-3" /> Back to Candidates
                        </Link>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-semibold">{candidate.name}</h1>
                                    {candidate.isLocked && (
                                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                            <Lock className="h-3 w-3" /> Locked
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground">{candidate.designation || 'Candidate'} · {candidate.status}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAssignOpen(!assignOpen)}
                                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-medium">
                                    <Plus className="h-3.5 w-3.5" /> Assign to Position
                                </button>
                                <button onClick={() => setEmailOpen(true)}
                                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" /> Email
                                </button>
                                {candidate.resumeFile && (
                                    <DocumentActions filename={candidate.resumeFile} type="resume" />
                                )}
                                {isAdmin && (
                                    <button
                                        onClick={() => lockMutation.mutate(!candidate.isLocked)}
                                        disabled={lockMutation.isPending}
                                        className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 font-medium ${candidate.isLocked
                                            ? 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        {candidate.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                        {candidate.isLocked ? 'Unlock' : 'Lock'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assign Position Modal */}
                {assignOpen && (
                    <div className="max-w-7xl mx-auto px-6 py-3">
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <h3 className="text-sm font-semibold mb-3">Assign to Position</h3>
                            <div className="flex items-center gap-3">
                                <select
                                    value={selectedPositionId}
                                    onChange={(e) => setSelectedPositionId(e.target.value)}
                                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                                >
                                    <option value="">Select a position...</option>
                                    {availablePositions.map((p: any) => (
                                        <option key={p._id} value={p._id}>
                                            {p.title} — {p.clientId?.companyName || 'No client'} ({p.status})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => selectedPositionId && assignMutation.mutate(selectedPositionId)}
                                    disabled={!selectedPositionId || assignMutation.isPending}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                                </button>
                                <button onClick={() => setAssignOpen(false)}
                                    className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                            </div>
                            {availablePositions.length === 0 && allPositions.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">All positions are already assigned to this candidate.</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Contact */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Contact Info</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-primary hover:underline">
                                    <Mail className="h-3.5 w-3.5" /> {candidate.email}
                                </a>
                                {candidate.phone && (
                                    <a href={`tel:${candidate.countryCode || '+91'}${candidate.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                                        <Phone className="h-3.5 w-3.5" /> {candidate.countryCode || '+91'} {candidate.phone}
                                    </a>
                                )}
                                {candidate.location && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5" /> {candidate.location}
                                    </div>
                                )}
                                {candidate.currentCompany && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Briefcase className="h-3.5 w-3.5" /> {candidate.currentCompany}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Professional */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Professional Info</h2>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="text-muted-foreground">Experience:</span> <span className="font-medium">{candidate.experience || 'N/A'}</span></div>
                                <div><span className="text-muted-foreground">CTC:</span> <span className="font-medium">{candidate.ctc ? `₹${candidate.ctc.toLocaleString()}` : 'N/A'}</span></div>
                                <div><span className="text-muted-foreground">Notice Period:</span> <span className="font-medium">{candidate.noticePeriod != null ? `${candidate.noticePeriod} days` : 'N/A'}</span></div>
                                <div><span className="text-muted-foreground">Designation:</span> <span className="font-medium">{candidate.designation || 'N/A'}</span></div>
                            </div>
                            {candidate.skills?.length > 0 && (
                                <div className="mt-4">
                                    <span className="text-xs text-muted-foreground">Skills:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {candidate.skills.map((s: string) => (
                                            <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Resume */}
                        {candidate.resumeFile && (
                            <div className="rounded-xl border border-border bg-card p-5">
                                <h2 className="text-sm font-semibold mb-3">Resume</h2>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileText className="h-4 w-4" />
                                        <span>{candidate.resumeFilename || candidate.resumeFile}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a href={`/api/files/download/${candidate.resumeFile}`} target="_blank" rel="noopener"
                                            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors">Download</a>
                                        <DocumentActions filename={candidate.resumeFile} type="resume" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pipeline Positions — THE CORE ATS FEATURE */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                <Briefcase className="h-4 w-4" /> Pipeline ({candidate.positions?.length || 0})
                            </h2>
                            {candidate.positions?.length > 0 ? (
                                <div className="space-y-3">
                                    {candidate.positions.map((cp: any) => (
                                        <div key={cp._id} className="rounded-lg border border-border p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Link href={`/positions/${cp.positionId?._id}`} className="text-sm font-medium hover:underline flex items-center gap-1">
                                                        {cp.positionId?.title || 'Unknown Position'}
                                                        <ChevronRight className="h-3 w-3" />
                                                    </Link>
                                                    <p className="text-xs text-muted-foreground">{cp.clientId?.companyName}</p>
                                                </div>
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStageStyle(cp.status)}`}>
                                                    {cp.status?.replace(/_/g, ' ')}
                                                </span>
                                            </div>

                                            {/* Pipeline Stage Selector */}
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

                                            {cp.remarks && (
                                                <p className="text-xs text-muted-foreground italic">"{cp.remarks}"</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-muted-foreground mb-3">Not assigned to any position yet</p>
                                    <button onClick={() => setAssignOpen(true)}
                                        className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                                        <Plus className="h-3.5 w-3.5 inline mr-1" /> Assign to Position
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Interviews */}
                        <InterviewScheduler
                            candidateId={id}
                            candidateName={candidate.name}
                            positionId={candidate.positionId?._id}
                            clientId={candidate.clientId?._id}
                        />

                        {/* Comments */}
                        <CommentsWidget entityType="candidate" entityId={id} />
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-3">Timeline</h2>
                            {candidate.timeline?.length > 0 ? (
                                <div className="space-y-3">
                                    {candidate.timeline.map((t: any) => (
                                        <div key={t._id} className="border-l-2 border-primary/20 pl-3">
                                            <p className="text-xs font-medium">
                                                {t.fromStatus && t.toStatus
                                                    ? `${t.fromStatus.replace(/_/g, ' ')} → ${t.toStatus.replace(/_/g, ' ')}`
                                                    : t.title || t.action
                                                }
                                            </p>
                                            <p className="text-xs text-muted-foreground">{t.notes || t.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                <Calendar className="h-3 w-3 inline mr-1" />
                                                {new Date(t.date || t.createdAt).toLocaleDateString()}
                                                {t.performedBy?.name && ` · ${t.performedBy.name}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-sm text-muted-foreground">No timeline entries yet</p>}
                        </div>

                        {/* Parsed Info & Lock Status */}
                        {(candidate.lastParsedBy || candidate.lastParsedAt || candidate.isLocked) && (
                            <div className="rounded-xl border border-border bg-card p-5">
                                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" /> Details
                                </h2>
                                <div className="space-y-2 text-sm">
                                    {candidate.lastParsedBy && (
                                        <div>
                                            <span className="text-muted-foreground">Parsed by: </span>
                                            <span className="font-medium">{candidate.lastParsedBy.name || candidate.lastParsedBy.email}</span>
                                        </div>
                                    )}
                                    {candidate.lastParsedAt && (
                                        <div>
                                            <span className="text-muted-foreground">Parsed on: </span>
                                            <span className="font-medium">{new Date(candidate.lastParsedAt).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    {candidate.isLocked && (
                                        <div>
                                            <span className="text-muted-foreground">Locked to: </span>
                                            <span className="font-medium">{candidate.lockedByPosition?.title || 'a position'}</span>
                                        </div>
                                    )}
                                    {candidate.createdBy && (
                                        <div>
                                            <span className="text-muted-foreground">Created by: </span>
                                            <span className="font-medium">{candidate.createdBy.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            <EmailComposeModal
                isOpen={emailOpen}
                onClose={() => setEmailOpen(false)}
                defaultTo={candidate.email}
                defaultSubject={`Regarding ${candidate.designation || 'Position'} - ${candidate.name}`}
                candidateId={id}
                resumeFile={candidate.resumeFile}
            />
        </AppShell>
    )
}
