'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Search, Plus, X, Upload, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function PositionsPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState({
        title: '', clientId: '', description: '', requirements: '',
        minExperience: '', maxExperience: '', location: '', budget: '', assignedTo: '',
    })
    const [jdFile, setJdFile] = useState<File | null>(null)
    const [parsing, setParsing] = useState(false)
    const [jdFileId, setJdFileId] = useState('')

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

    const handleJdUpload = async (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`)
            return
        }
        setParsing(true)
        try {
            // Upload file
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', 'jd')
            const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
            if (!uploadRes.ok) { toast.error('Upload failed'); return }
            const uploadData = await uploadRes.json()

            // Parse JD
            const parseFd = new FormData()
            parseFd.append('file', file)
            const parseRes = await apiFetch('/api/parse-jd', { method: 'POST', body: parseFd })
            const response = await parseRes.json()
            const data = response.data

            if (parseRes.ok && data) {
                toast.success('JD parsed \u2014 fields auto-filled')
                setJdFileId(uploadData.storageId || '')
                setForm(prev => ({
                    ...prev,
                    title: data.title || prev.title,
                    description: data.description || prev.description,
                    requirements: data.requirements?.length
                        ? data.requirements.join('\n')
                        : (data.responsibilities?.length ? data.responsibilities.join('\n') : prev.requirements),
                    minExperience: data.minExperience?.toString() || prev.minExperience,
                    maxExperience: data.maxExperience?.toString() || prev.maxExperience,
                    location: data.location || prev.location,
                    budget: data.budget || prev.budget,
                }))
                setJdFile(file)
            } else {
                toast.info('JD uploaded but parsing had issues \u2014 fill fields manually')
                setJdFileId(uploadData.storageId || '')
                setJdFile(file)
            }
        } catch {
            toast.error('Failed to process JD')
        } finally {
            setParsing(false)
        }
    }

    const { data: positions = [] } = useQuery({
        queryKey: ['positions', statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (statusFilter) params.set('status', statusFilter)
            if (search) params.set('search', search)
            const res = await apiFetch(`/api/positions?${params}`)
            return res.json()
        },
    })

    // Users list for Assign To dropdown
    const { data: usersList = [] } = useQuery({
        queryKey: ['users-for-assign'],
        queryFn: async () => {
            const res = await apiFetch('/api/users')
            return res.json()
        },
        enabled: showCreate,
    })

    const { data: clients = [] } = useQuery({
        queryKey: ['clients-list'],
        queryFn: async () => {
            const res = await apiFetch('/api/clients')
            return res.json()
        },
        enabled: showCreate,
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            // Upload JD if not already uploaded during parsing
            let fileId = jdFileId
            if (!fileId && jdFile) {
                const fd = new FormData()
                fd.append('file', jdFile)
                fd.append('type', 'jd')
                const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json()
                    fileId = uploadData.storageId
                }
            }

            const res = await apiFetch('/api/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, jdFile: fileId || undefined }),
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed') }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['positions'] })
            setShowCreate(false)
            setForm({ title: '', clientId: '', description: '', requirements: '', minExperience: '', maxExperience: '', location: '', budget: '', assignedTo: '' })
            setJdFile(null)
            setJdFileId('')
            toast.success('Position created successfully')
        },
        onError: (err: any) => toast.error(err.message),
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate({
            title: form.title,
            clientId: form.clientId || undefined,
            description: form.description,
            requirements: form.requirements.split('\n').filter(r => r.trim()),
            minExperience: form.minExperience ? Number(form.minExperience) : undefined,
            maxExperience: form.maxExperience ? Number(form.maxExperience) : undefined,
            location: form.location,
            budget: form.budget,
            assignedTo: form.assignedTo || undefined,
        })
    }

    const openCount = positions.filter((p: any) => p.status !== 'closed').length

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
                            <p className="text-sm text-muted-foreground mt-1">{openCount} open · {positions.length} total</p>
                        </div>
                        <button onClick={() => setShowCreate(true)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Create Position
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex gap-3 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                                placeholder="Search positions..." />
                        </div>
                        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="work-in-progress">In Progress</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        {positions.map((pos: any) => (
                            <Link key={pos._id} href={`/positions/${pos._id}`}>
                                <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all cursor-pointer flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                            <Briefcase className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold">{pos.title}</h3>
                                            <p className="text-xs text-muted-foreground">{pos.clientId?.companyName || 'No client'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {pos.assignedTo && <span className="text-xs text-muted-foreground">{pos.assignedTo.name}</span>}
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${pos.status === 'new' ? 'bg-blue-100 text-blue-700' : pos.status === 'work-in-progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {pos.status}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {positions.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground text-sm">No positions found</div>
                    )}
                </div>
            </div>

            {/* Create Position Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold">Create New Position</h2>
                            <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Position Title *</label>
                                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Client *</label>
                                    <Select value={form.clientId} onValueChange={(val) => setForm({ ...form, clientId: val })}>
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder="Select client..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map((c: any) => (
                                                <SelectItem key={c._id} value={c._id}>{c.companyName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Description</label>
                                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
                                    placeholder="Job description..." />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Requirements (one per line)</label>
                                <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                                    rows={3} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
                                    placeholder="e.g. 5+ years in React&#10;Strong communication skills&#10;MBA preferred" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Min Experience (years)</label>
                                    <input type="number" step="any" value={form.minExperience} onChange={(e) => setForm({ ...form, minExperience: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Max Experience (years)</label>
                                    <input type="number" step="any" value={form.maxExperience} onChange={(e) => setForm({ ...form, maxExperience: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Location</label>
                                    <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" placeholder="e.g. Mumbai" />
                                </div>
                            </div>

                            {/* JD Upload */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Assign To (TL / Recruiter)</label>
                                <Select value={form.assignedTo || 'unassigned'} onValueChange={(val) => setForm({ ...form, assignedTo: val === 'unassigned' ? '' : val })}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Self (me)</SelectItem>
                                        {usersList.filter((u: any) => ['team_lead', 'recruiter', 'operations_head', 'super_admin'].includes(u.role)).map((u: any) => (
                                            <SelectItem key={u._id} value={u._id}>{u.name} ({u.role === 'team_lead' ? 'Team Lead' : u.role === 'recruiter' ? 'Recruiter' : u.role === 'operations_head' ? 'Ops Head' : 'Admin'})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* JD Upload */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Upload JD (PDF / DOC / DOCX)</label>
                                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => { if (e.target.files?.[0]) handleJdUpload(e.target.files[0]) }} className="hidden" />
                                <button type="button" onClick={() => fileRef.current?.click()} disabled={parsing}
                                    className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-3 text-sm border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50">
                                    {parsing ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                                    <span className="text-muted-foreground">{parsing ? 'Parsing JD...' : (jdFile ? jdFile.name : 'Click to upload JD file — auto-fills fields')}</span>
                                </button>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                                    {createMutation.isPending ? 'Creating...' : 'Create Position'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    )
}
