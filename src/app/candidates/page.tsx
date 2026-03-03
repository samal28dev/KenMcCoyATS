'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, X, Upload, Loader2, Mail, Download, Briefcase, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-picker'
import { toast } from 'sonner'

const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+971', '+65', '+49', '+33', '+86', '+81']

export default function CandidatesPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showCreate, setShowCreate] = useState(false)
    const [parsing, setParsing] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkAssign, setShowBulkAssign] = useState(false)
    const [showBulkEmail, setShowBulkEmail] = useState(false)
    const [bulkAssignPositionId, setBulkAssignPositionId] = useState('')
    const [bulkEmailSubject, setBulkEmailSubject] = useState('')
    const [bulkEmailContent, setBulkEmailContent] = useState('')

    const [form, setForm] = useState({
        name: '', email: '', phone: '', alternativeMobile: '',
        countryCode: '+91', alternativeCountryCode: '+91',
        designation: '', currentCompany: '', location: '',
        experience: '', ctc: '', noticePeriod: '', dob: '',
        qualifications: '', skills: '', resumeFile: '', resumeFilename: '',
        resumePdfVersion: '', resumeDocVersion: '',
    })

    const { data } = useQuery({
        queryKey: ['candidates', statusFilter, search, page],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (statusFilter) params.set('status', statusFilter)
            if (search) params.set('search', search)
            params.set('page', page.toString())
            params.set('limit', '30')
            const res = await apiFetch(`/api/candidates?${params}`)
            return res.json()
        },
    })

    const candidates = data?.candidates ?? []
    const total = data?.total ?? 0
    const totalPages = data?.totalPages ?? 1

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiFetch('/api/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed') }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] })
            setShowCreate(false)
            resetForm()
            toast.success('Candidate created successfully')
        },
        onError: (err: any) => toast.error(err.message),
    })

    const resetForm = () => {
        setForm({ name: '', email: '', phone: '', alternativeMobile: '', countryCode: '+91', alternativeCountryCode: '+91', designation: '', currentCompany: '', location: '', experience: '', ctc: '', noticePeriod: '', dob: '', qualifications: '', skills: '', resumeFile: '', resumeFilename: '', resumePdfVersion: '', resumeDocVersion: '' })
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

    const handleResumeUpload = async (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
            toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`)
            return
        }
        setParsing(true)
        try {
            // Upload file
            const fd = new FormData()
            fd.append('file', file)
            fd.append('type', 'resume')
            const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: fd })
            if (!uploadRes.ok) { toast.error('Upload failed'); return }
            const uploadData = await uploadRes.json()
            const pdfVer = uploadData.file?.pdfVersion || ''
            const docxVer = uploadData.file?.docxVersion || ''

            // Parse resume
            const parseFd = new FormData()
            parseFd.append('file', file)
            const parseRes = await apiFetch('/api/parse-resume', { method: 'POST', body: parseFd })

            let response = await parseRes.json()
            const data = response.data

            if (parseRes.ok && data) {
                toast.success('Resume parsed — fields auto-filled')

                // Try to extract current role/company from experience array as fallback
                const currentExp = Array.isArray(data.experience)
                    ? data.experience.find((e: any) => /present|current|till\s*date|ongoing|now/i.test(e.endDate || ''))
                        || data.experience[0]
                    : null
                const fallbackRole = currentExp?.title || ''
                const fallbackCompany = currentExp?.company || ''

                setForm(prev => ({
                    ...prev,
                    name: (data.personalInfo?.firstName && data.personalInfo?.lastName)
                        ? `${data.personalInfo.firstName} ${data.personalInfo.lastName}`
                        : (data.personalInfo?.firstName || data.name || prev.name),
                    email: data.personalInfo?.email || data.email || prev.email,
                    phone: data.personalInfo?.phone || data.phone || prev.phone,
                    alternativeMobile: data.personalInfo?.altPhone || prev.alternativeMobile,
                    designation: data.currentRole || data.currentDesignation || data.designation || fallbackRole || prev.designation,
                    currentCompany: data.currentCompany || fallbackCompany || prev.currentCompany,
                    location: data.personalInfo?.location || data.location || prev.location,
                    experience: data.yearsOfExperience?.toString() || data.experience?.toString() || prev.experience,
                    dob: data.personalInfo?.dob || prev.dob,
                    ctc: data.ctc?.toString() || prev.ctc,
                    noticePeriod: data.noticePeriod?.toString() || prev.noticePeriod,
                    qualifications: (Array.isArray(data.allQualifications) && data.allQualifications.length > 0)
                        ? data.allQualifications.join(', ')
                        : data.qualification
                        || (Array.isArray(data.education) && data.education.length ? data.education.map((e: any) => `${e.degree}${e.field ? ' - ' + e.field : ''}`).join(', ') : '')
                        || (Array.isArray(data.qualifications) ? data.qualifications.join(', ') : prev.qualifications),
                    skills: data.skills?.technical
                        ? [...data.skills.technical, ...(data.skills?.certifications || [])].join(', ')
                        : (Array.isArray(data.skills) ? data.skills.join(', ') : prev.skills),
                    resumeFile: uploadData.storageId,
                    resumeFilename: file.name,
                }))
            } else {
                toast.info('Resume uploaded but parsing had issues — fill fields manually')
                setForm(prev => ({
                    ...prev,
                    resumeFile: uploadData.storageId,
                    resumeFilename: file.name,
                    resumePdfVersion: pdfVer,
                    resumeDocVersion: docxVer,
                }))
            }
        } catch {
            toast.error('Failed to process resume')
        } finally {
            setParsing(false)
        }
    }

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate({
            name: form.name,
            email: form.email,
            phone: form.phone,
            alternativeMobile: form.alternativeMobile || undefined,
            countryCode: form.countryCode,
            alternativeCountryCode: form.alternativeCountryCode,
            designation: form.designation,
            currentCompany: form.currentCompany,
            location: form.location,
            experience: form.experience ? Number(form.experience) : undefined,
            ctc: form.ctc ? Number(form.ctc) : undefined,
            noticePeriod: form.noticePeriod ? Number(form.noticePeriod) : undefined,
            dob: form.dob || undefined,
            qualifications: form.qualifications ? form.qualifications.split(',').map(q => q.trim()).filter(Boolean) : [],
            skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
            resumeFile: form.resumeFile || undefined,
            resumeFilename: form.resumeFilename || undefined,
            resumePdfVersion: form.resumePdfVersion || undefined,
            resumeDocVersion: form.resumeDocVersion || undefined,
        })
    }

    const statusColors: Record<string, string> = {
        new: 'bg-blue-100 text-blue-700',
        screening: 'bg-indigo-100 text-indigo-700',
        shortlisted: 'bg-purple-100 text-purple-700',
        interview: 'bg-yellow-100 text-yellow-700',
        offered: 'bg-orange-100 text-orange-700',
        joined: 'bg-green-100 text-green-700',
        rejected: 'bg-red-100 text-red-700',
        on_hold: 'bg-gray-100 text-gray-700',
    }

    // Bulk selection helpers
    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }
    const toggleSelectAll = () => {
        if (selectedIds.size === candidates.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(candidates.map((c: any) => c._id)))
        }
    }
    const clearSelection = () => setSelectedIds(new Set())

    // Positions list for bulk assign
    const { data: positionsList = [] } = useQuery({
        queryKey: ['positions-list-for-assign'],
        queryFn: async () => {
            const res = await apiFetch('/api/positions')
            return res.json()
        },
        enabled: showBulkAssign,
    })

    // Bulk assign mutation
    const bulkAssignMutation = useMutation({
        mutationFn: async () => {
            const res = await apiFetch('/api/candidates/bulk-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateIds: Array.from(selectedIds),
                    positionId: bulkAssignPositionId,
                }),
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(data.message)
            if (data.skipped > 0) toast.info(`${data.skipped} candidate(s) were already assigned`)
            setShowBulkAssign(false)
            setBulkAssignPositionId('')
            clearSelection()
            queryClient.invalidateQueries({ queryKey: ['candidates'] })
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Bulk email mutation
    const bulkEmailMutation = useMutation({
        mutationFn: async () => {
            const selectedCandidates = candidates.filter((c: any) => selectedIds.has(c._id))
            const recipients = selectedCandidates.map((c: any) => c.email).filter(Boolean)
            const candidateIds = selectedCandidates.map((c: any) => c._id)
            if (recipients.length === 0) throw new Error('No email addresses found for selected candidates')
            const res = await apiFetch('/api/emails/bulk-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    subject: bulkEmailSubject,
                    content: bulkEmailContent,
                    candidateIds,
                }),
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(data.message || `Email sent to ${data.sent} candidate(s)`)
            setShowBulkEmail(false)
            setBulkEmailSubject('')
            setBulkEmailContent('')
            clearSelection()
        },
        onError: (err: any) => toast.error(err.message),
    })

    // Bulk export
    const handleBulkExport = async () => {
        try {
            const res = await apiFetch('/api/candidates/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            })
            if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Export failed'); return }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `candidates-export-${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`Exported ${selectedIds.size} candidate(s)`)
        } catch {
            toast.error('Export failed')
        }
    }

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
                            <p className="text-sm text-muted-foreground mt-1">{total} total</p>
                        </div>
                        <button onClick={() => setShowCreate(true)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Candidate
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex gap-3 mb-6 items-center">
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0" title="Select all">
                            <input type="checkbox"
                                checked={candidates.length > 0 && selectedIds.size === candidates.length}
                                onChange={toggleSelectAll}
                                className="rounded border-border h-4 w-4 accent-primary" />
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        </label>
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                                placeholder="Search by name, email, phone..." />
                        </div>
                        <Select value={statusFilter || 'all'} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1) }}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="screening">Screening</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="interview">Interview</SelectItem>
                                <SelectItem value="offered">Offered</SelectItem>
                                <SelectItem value="joined">Joined</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {candidates.map((c: any) => (
                            <div key={c._id} className="relative group">
                                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox"
                                        checked={selectedIds.has(c._id)}
                                        onChange={() => toggleSelect(c._id)}
                                        className="rounded border-border h-4 w-4 accent-primary cursor-pointer" />
                                </div>
                                <Link href={`/candidates/${c._id}`}>
                                    <div className={`rounded-xl border bg-card p-4 pl-9 hover:shadow-md transition-all cursor-pointer ${selectedIds.has(c._id) ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-sm font-semibold">{c.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {c.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{c.email}</p>
                                    {c.phone && <p className="text-xs text-muted-foreground">{c.countryCode || '+91'} {c.phone}</p>}
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {c.designation && <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.designation}</span>}
                                        {c.location && <span className="text-xs bg-muted px-2 py-0.5 rounded">{c.location}</span>}
                                    </div>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>

                    {candidates.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground text-sm">No candidates found</div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent disabled:opacity-50">Previous</button>
                            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent disabled:opacity-50">Next</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Candidate Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold">Add New Candidate</h2>
                            <button onClick={() => { setShowCreate(false); resetForm() }} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Resume Upload */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Upload Resume (PDF / DOC / DOCX) — auto-parses fields</label>
                                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => { if (e.target.files?.[0]) handleResumeUpload(e.target.files[0]) }} className="hidden" />
                                <button type="button" onClick={() => fileRef.current?.click()} disabled={parsing}
                                    className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-3 text-sm border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-60">
                                    {parsing ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Parsing resume...</>
                                    ) : (
                                        <><Upload className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-muted-foreground">{form.resumeFilename || 'Click to upload resume'}</span></>
                                    )}
                                </button>
                            </div>

                            {/* Personal */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Full Name *</label>
                                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Email *</label>
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Mobile</label>
                                    <div className="flex gap-1 mt-1">
                                        <Select value={form.countryCode} onValueChange={(val) => setForm({ ...form, countryCode: val })}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COUNTRY_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            placeholder="10-digit" className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Alt Mobile</label>
                                    <div className="flex gap-1 mt-1">
                                        <Select value={form.alternativeCountryCode} onValueChange={(val) => setForm({ ...form, alternativeCountryCode: val })}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COUNTRY_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <input value={form.alternativeMobile} onChange={(e) => setForm({ ...form, alternativeMobile: e.target.value })}
                                            placeholder="Alternative" className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                    </div>
                                </div>
                            </div>

                            {/* Professional */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Current Designation</label>
                                    <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Current/Last Company</label>
                                    <input value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Experience (yrs)</label>
                                    <input type="number" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">CTC (INR)</label>
                                    <input type="number" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Notice (days)</label>
                                    <input type="number" value={form.noticePeriod} onChange={(e) => setForm({ ...form, noticePeriod: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">DOB</label>
                                    <div className="mt-1">
                                        <DateInput value={form.dob} onChange={(val) => setForm({ ...form, dob: val })} placeholder="Date of birth" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Location</label>
                                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" placeholder="e.g. Mumbai" />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Qualifications (comma-separated)</label>
                                <input value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" placeholder="e.g. B.Tech, MBA" />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Skills (comma-separated)</label>
                                <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })}
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" placeholder="e.g. React, Node.js, Python" />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => { setShowCreate(false); resetForm() }}
                                    className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                                    {createMutation.isPending ? 'Creating...' : 'Create Candidate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating Bulk Action Toolbar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-background border border-border rounded-xl shadow-xl">
                    <span className="text-xs font-semibold text-primary">{selectedIds.size} selected</span>
                    <div className="h-4 w-px bg-border" />
                    <button onClick={() => setShowBulkAssign(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                        <Briefcase className="h-3.5 w-3.5" /> Assign Position
                    </button>
                    <button onClick={() => setShowBulkEmail(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                        <Mail className="h-3.5 w-3.5" /> Send Email
                    </button>
                    <button onClick={handleBulkExport}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
                        <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                    <div className="h-4 w-px bg-border" />
                    <button onClick={clearSelection}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Clear selection">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>
            )}

            {/* Bulk Assign to Position Modal */}
            {showBulkAssign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-md m-4 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold">Assign {selectedIds.size} Candidate(s) to Position</h2>
                            <button onClick={() => setShowBulkAssign(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="mb-4">
                            <label className="text-xs font-medium text-muted-foreground">Select Position</label>
                            <Select value={bulkAssignPositionId || 'none'} onValueChange={(val) => setBulkAssignPositionId(val === 'none' ? '' : val)}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Choose a position..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none" disabled>Choose a position...</SelectItem>
                                    {positionsList.map((p: any) => (
                                        <SelectItem key={p._id} value={p._id}>
                                            {p.title} {p.clientId?.name ? `— ${p.clientId.name}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowBulkAssign(false)}
                                className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                            <button onClick={() => bulkAssignMutation.mutate()}
                                disabled={!bulkAssignPositionId || bulkAssignMutation.isPending}
                                className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                                {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Email Modal */}
            {showBulkEmail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-lg m-4 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold">Email {selectedIds.size} Candidate(s)</h2>
                            <button onClick={() => setShowBulkEmail(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Recipients</label>
                                <p className="mt-1 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                                    {candidates.filter((c: any) => selectedIds.has(c._id)).map((c: any) => c.email).filter(Boolean).join(', ') || 'No emails found'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Subject *</label>
                                <input value={bulkEmailSubject} onChange={(e) => setBulkEmailSubject(e.target.value)}
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" placeholder="Email subject" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Message *</label>
                                <textarea value={bulkEmailContent} onChange={(e) => setBulkEmailContent(e.target.value)}
                                    rows={6} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y" placeholder="Write your message..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowBulkEmail(false)}
                                className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                            <button onClick={() => bulkEmailMutation.mutate()}
                                disabled={!bulkEmailSubject || !bulkEmailContent || bulkEmailMutation.isPending}
                                className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                {bulkEmailMutation.isPending ? 'Sending...' : 'Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    )
}
