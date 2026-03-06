'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Mail, Phone, MapPin, Briefcase, FileText, Lock, Plus,
    Bookmark, ChevronDown, Check, X, Send, Clock, Forward, Video,
    GraduationCap, Download, ExternalLink, ListPlus, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { use, useState, Suspense, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import { HighlightArray, HighlightText } from '@/components/ui/highlight-text'
import { useSearchParams } from 'next/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

function CandidateDetailContent({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const searchParams = useSearchParams()

    const [activeTab, setActiveTab] = useState<'details' | 'cv'>('details')
    const [showPhone, setShowPhone] = useState(false)
    const [isCreatingList, setIsCreatingList] = useState(false)
    const [newListName, setNewListName] = useState('')
    const [cvError, setCvError] = useState(false)
    const [cvBlobUrl, setCvBlobUrl] = useState<string | null>(null)
    const [cvLoading, setCvLoading] = useState(false)
    const [maskPii, setMaskPii] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState<any>({})
    const queryClient = useQueryClient()

    const saveMutation = useMutation({
        mutationFn: async (isSaved: boolean) => {
            const res = await apiFetch(`/api/candidates/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ isSaved }),
            })
            if (!res.ok) throw new Error('Failed to update save status')
            return res.json()
        },
        onMutate: async (newIsSaved) => {
            await queryClient.cancelQueries({ queryKey: ['candidate', id] })
            const previousCandidate = queryClient.getQueryData(['candidate', id])
            queryClient.setQueryData(['candidate', id], (old: any) => ({
                ...old,
                isSaved: newIsSaved
            }))
            return { previousCandidate }
        },
        onSuccess: (data, newIsSaved) => {
            queryClient.invalidateQueries({ queryKey: ['candidate', id] })
            toast.success(newIsSaved ? 'Candidate saved successfully' : 'Candidate removed from saved')
        },
        onError: (err: Error, newIsSaved, context) => {
            if (context?.previousCandidate) {
                queryClient.setQueryData(['candidate', id], context.previousCandidate)
            }
            toast.error(err.message)
        }
    })

    const editMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiFetch(`/api/candidates/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error('Failed to update profile')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidate', id] })
            setIsEditing(false)
            toast.success('Profile updated successfully')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const { data: lists, isLoading: isLoadingLists } = useQuery({
        queryKey: ['candidate-lists'],
        queryFn: async () => {
            const res = await apiFetch('/api/candidate-lists')
            if (!res.ok) throw new Error('Failed to fetch lists')
            return res.json()
        }
    })

    const createListMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await apiFetch('/api/candidate-lists', {
                method: 'POST',
                body: JSON.stringify({ name }),
            })
            if (!res.ok) throw new Error('Failed to create list')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidate-lists'] })
            setIsCreatingList(false)
            setNewListName('')
            toast.success('List created successfully')
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const addToListMutation = useMutation({
        mutationFn: async (listId: string) => {
            const res = await apiFetch(`/api/candidate-lists/${listId}/candidates`, {
                method: 'POST',
                body: JSON.stringify({ candidateId: id }),
            })
            if (!res.ok) throw new Error('Failed to add to list')
            return res.json()
        },
        onSuccess: () => {
            toast.success('Candidate added to list')
        },
        onError: (err: Error) => toast.error(err.message)
    })

    const { data: candidate, isLoading, isError, error } = useQuery({
        queryKey: ['candidate', id],
        queryFn: async () => {
            const res = await apiFetch(`/api/candidates/${id}`)
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.message || `Error ${res.status}`)
            }
            return res.json()
        },
        retry: 1,
    })

    // Fetch CV as blob when CV tab is active so auth cookies are sent via apiFetch
    // Uses /api/files/view which always watermarks and optionally masks PII
    useEffect(() => {
        if (activeTab !== 'cv' || !candidate) return
        const storageId = candidate.resumePdfVersion || candidate.resumeFile
        if (!storageId || !/\.pdf$/i.test(candidate.resumeFilename || storageId)) return
        setCvBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
        setCvError(false)
        setCvLoading(true)
        apiFetch(`/api/files/view/${storageId}${maskPii ? '?mask=true' : ''}`)
            .then(res => { if (!res.ok) throw new Error('not ok'); return res.blob() })
            .then(blob => setCvBlobUrl(URL.createObjectURL(blob)))
            .catch(() => setCvError(true))
            .finally(() => setCvLoading(false))
    }, [activeTab, candidate?.resumePdfVersion, candidate?.resumeFile, candidate?.resumeFilename, maskPii])

    if (isLoading) {
        return <AppShell><div className="flex items-center justify-center min-h-screen bg-[#f3f6f9]"><p className="text-gray-500">Loading profile...</p></div></AppShell>
    }

    if (isError || !candidate) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f6f9] gap-4">
                    <p className="text-red-500 font-medium">{(error as Error)?.message || 'Failed to load candidate profile'}</p>
                    <Link href="/candidates" className="text-sm text-blue-600 hover:underline">← Back to candidates</Link>
                </div>
            </AppShell>
        )
    }

    // Support picking up queries from URL, e.g., ?q=SAP,Schneider Electric
    const queryParam = searchParams.get('q')
    const queries = queryParam ? queryParam.split(',') : [];

    // Use real data where possible, with fallbacks only for UI presentation structural integrity
    const name = candidate.name
    const experience = candidate.experience ? `${candidate.experience} yrs` : null
    const ctc = candidate.ctc ? `₹ ${(candidate.ctc / 100000).toFixed(2)} Lacs` : null
    const location = candidate.location || null

    // Structured Work Experience
    const workExperience = (candidate.workExperience || []).sort((a: any, b: any) => {
        if (!a.startDate) return 1
        if (!b.startDate) return -1
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })
    const educationEntries = candidate.education || []
    const projects = candidate.projects || []
    const summaryFromDB = candidate.summary
    // Previous role logic - Use structured if available
    let previousRole = null
    if (workExperience.length > 0) {
        const current = workExperience[0]
        previousRole = `${current.title}${current.company ? ' at ' + current.company : ''}`
    } else if (candidate.designation && candidate.currentCompany) {
        previousRole = `${candidate.designation} at ${candidate.currentCompany}`
    } else if (candidate.designation) {
        previousRole = candidate.designation
    } else if (candidate.currentCompany) {
        previousRole = `Employee at ${candidate.currentCompany}`
    }

    // Education / Qualifications
    const qualsFromEducation = educationEntries.map((e: any) => `${e.degree}${e.field ? ' - ' + e.field : ''}${e.institution ? ' from ' + e.institution : ''}`)
    const qualsList = qualsFromEducation.length > 0 ? qualsFromEducation : (candidate.qualifications || [])
    const highestDegreeStr = qualsList.length > 0 ? qualsList[0] : null

    const prefLocations = null
    const email = candidate.email || null

    // Skills
    const keySkills = candidate.skills && candidate.skills.length > 0 ? candidate.skills : []
    const topSkills = keySkills.slice(0, 10)
    const mayAlsoKnow = keySkills.slice(10)

    // About/Summary
    const summaryText = summaryFromDB || (keySkills.length > 0
        ? `Experienced professional with expertise in ${keySkills.slice(0, 5).join(', ')}.`
        : (candidate.designation ? `Professional working as ${candidate.designation}.` : null))

    const ResumeView = () => (
        <div className="mt-8 border border-border bg-card shadow-sm flex min-h-[800px] text-foreground rounded overflow-hidden">
            {/* Left Column */}
            <div className="w-[35%] bg-blue-600 dark:bg-blue-900/40 text-white py-8 px-6 font-sans">
                <h2 className="text-[22px] font-bold text-center leading-tight mb-4 uppercase">
                    {name}
                </h2>
                {candidate.designation && (
                    <p className="text-[14px] text-center font-semibold mb-6">
                        <HighlightText text={candidate.designation} queries={queries} />
                    </p>
                )}

                <div className="w-full h-px bg-white/30 my-6"></div>

                <div className="space-y-3 text-center text-[13px]">
                    {candidate.phone && <p><HighlightText text={candidate.phone} queries={queries} /></p>}
                    {email && <p>{email}</p>}
                    {candidate.linkedin && (
                        <>
                            <p className="font-semibold mt-2">LinkedIn</p>
                            <p className="text-[11px] break-all opacity-90">{candidate.linkedin}</p>
                        </>
                    )}
                    {candidate.github && (
                        <>
                            <p className="font-semibold mt-2">GitHub</p>
                            <p className="text-[11px] break-all opacity-90">{candidate.github}</p>
                        </>
                    )}
                    {candidate.portfolio && (
                        <>
                            <p className="font-semibold mt-2">Portfolio</p>
                            <p className="text-[11px] break-all opacity-90">{candidate.portfolio}</p>
                        </>
                    )}
                </div>

                {(keySkills.length > 0 || (qualsList.length > 0)) && (
                    <>
                        <div className="w-full h-px bg-foreground/20 my-6"></div>
                        <h3 className="text-[16px] font-bold mb-6">SKILLS & DETAILS</h3>
                        <div className="space-y-4 text-[13px]">
                            {keySkills.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-1 opacity-90">Key Skills</h4>
                                    <p><HighlightText text={keySkills.join(', ')} queries={queries} /></p>
                                </div>
                            )}
                            {qualsList.length > 0 && (
                                <div>
                                    <h4 className="font-semibold mb-1 opacity-90">Education</h4>
                                    <div className="space-y-2">
                                        {qualsList.map((q: string, i: number) => (
                                            <p key={i}><HighlightText text={q} queries={queries} /></p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Right Column */}
            <div className="w-[65%] py-8 px-8 font-sans">
                {summaryText && (
                    <>
                        <h3 className="text-[18px] font-bold mb-4 uppercase text-foreground">SUMMARY</h3>
                        <p className="text-[14px] mb-8 leading-relaxed text-muted-foreground">
                            <HighlightText text={summaryText} queries={queries} />
                        </p>
                    </>
                )}

                {(workExperience.length > 0 || previousRole || candidate.experience || candidate.location) && (
                    <>
                        <h3 className="text-[18px] font-bold mb-4 uppercase">WORK EXPERIENCE</h3>

                        <div className="space-y-6">
                            {workExperience.length > 0 ? (
                                workExperience.map((exp: any, idx: number) => (
                                    <div key={idx} className="mb-6">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="text-[15px] font-bold">
                                                <HighlightText text={`${exp.title}${exp.company ? ' at ' + exp.company : ''}`} queries={queries} />
                                            </h4>
                                            <span className="text-[12px] text-muted-foreground font-medium">
                                                {exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                                                {' - '}
                                                {exp.isCurrent ? 'Present' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')}
                                            </span>
                                        </div>
                                        <div className="text-[14px] text-muted-foreground leading-relaxed mb-2">
                                            <HighlightText text={exp.description || ''} queries={queries} />
                                        </div>
                                        {exp.highlights && exp.highlights.length > 0 && (
                                            <ul className="list-disc pl-4 space-y-1 text-[13px] text-muted-foreground/80">
                                                {exp.highlights.map((h: string, i: number) => (
                                                    <li key={i}><HighlightText text={h} queries={queries} /></li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div>
                                    {previousRole && (
                                        <h4 className="text-[15px] font-bold mb-1">
                                            <HighlightText text={previousRole} queries={queries} />
                                        </h4>
                                    )}
                                    {candidate.experience && (
                                        <p className="text-[14px] font-semibold mb-2">{candidate.experience} Years Experience</p>
                                    )}
                                    <ul className="list-disc pl-4 space-y-1.5 text-[14px] text-muted-foreground">
                                        {candidate.location && (
                                            <li><HighlightText text={`Professional working in ${candidate.location}.`} queries={queries} /></li>
                                        )}
                                        {candidate.currentCompany ? (
                                            <li><HighlightText text={`Currently working at ${candidate.currentCompany}.`} queries={queries} /></li>
                                        ) : null}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {projects.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-[18px] font-bold mb-4 uppercase">PROJECTS</h3>
                        <div className="space-y-6">
                            {projects.map((proj: any, idx: number) => (
                                <div key={idx} className="mb-4">
                                    <h4 className="text-[15px] font-bold mb-1">
                                        <HighlightText text={proj.name} queries={queries} />
                                    </h4>
                                    <p className="text-[14px] text-muted-foreground leading-relaxed mb-2">
                                        <HighlightText text={proj.description || ''} queries={queries} />
                                    </p>
                                    {proj.technologies && proj.technologies.length > 0 && (
                                        <p className="text-[13px] text-gray-500 italic">
                                            Technologies: <HighlightText text={proj.technologies.join(', ')} queries={queries} />
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <AppShell>
            {/* Background should be very light gray #f3f6f9 */}
            <div className="min-h-screen bg-background pb-20 font-sans text-foreground">

                {/* Fixed Top Action Bar mimicking Naukri exact style */}
                <div className="bg-card border-b border-border shadow-sm mb-4">
                    <div className="max-w-[1000px] mx-auto flex items-center gap-6 px-4 py-3 text-[14px] font-medium text-muted-foreground">
                        <Link href="/candidates" className="text-muted-foreground hover:text-foreground mr-2" title="Back">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1.5 hover:text-primary transition-colors focus:outline-none">
                                    <ListPlus className="w-4 h-4 text-muted-foreground/60" />
                                    Add to <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[240px]">
                                <DropdownMenuLabel>Add to List</DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                <div className="max-h-[200px] overflow-y-auto">
                                    {isLoadingLists ? (
                                        <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                                    ) : lists?.length === 0 ? (
                                        <div className="text-sm text-muted-foreground px-2 py-3 text-center">No lists created yet</div>
                                    ) : (
                                        lists?.map((list: any) => (
                                            <DropdownMenuItem
                                                key={list._id}
                                                onClick={() => addToListMutation.mutate(list._id)}
                                                className="cursor-pointer flex items-center gap-2"
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: list.color || '#3B82F6' }}></div>
                                                <span className="truncate">{list.name}</span>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </div>

                                <DropdownMenuSeparator />

                                {isCreatingList ? (
                                    <div className="p-2 flex gap-2" onClick={e => e.stopPropagation()}>
                                        <Input
                                            autoFocus
                                            placeholder="List name..."
                                            value={newListName}
                                            onChange={e => setNewListName(e.target.value)}
                                            className="h-8 text-sm"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newListName.trim()) {
                                                    createListMutation.mutate(newListName.trim())
                                                } else if (e.key === 'Escape') {
                                                    setIsCreatingList(false)
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => newListName.trim() && createListMutation.mutate(newListName.trim())}
                                            disabled={!newListName.trim() || createListMutation.isPending}
                                            className="bg-primary text-primary-foreground px-2 rounded hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center min-w-[32px]"
                                        >
                                            {createListMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <button
                                            onClick={() => setIsCreatingList(false)}
                                            className="bg-muted text-muted-foreground px-2 rounded hover:bg-muted/80 flex items-center justify-center min-w-[32px]"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <DropdownMenuItem
                                        onClick={(e) => { e.preventDefault(); setIsCreatingList(true); }}
                                        className="cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
                                    >
                                        <Plus className="w-4 h-4 mr-2" /> Create new list
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors" onClick={() => toast.info('NVite feature coming soon')}>
                            <Send className="w-4 h-4" /> Send NVite
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors" onClick={() => toast.info('Reminder feature coming soon')}>
                            <Clock className="w-4 h-4" /> Set reminder <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors" onClick={() => toast.info('Forward feature coming soon')}>
                            <Forward className="w-4 h-4" /> Forward
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors" onClick={() => toast.info('Video call integration coming soon')}>
                            <Video className="w-4 h-4" /> Schedule video call
                        </button>
                    </div>
                </div>

                <div className="max-w-[1000px] mx-auto px-4 space-y-4">

                    {/* CARD 1: Profile Header */}
                    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                        <div className="p-6 relative">
                            {/* Save & Edit Buttons Top Right */}
                            <div className="absolute top-6 right-6 flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setEditForm({
                                            name: candidate.name || '',
                                            designation: candidate.designation || '',
                                            currentCompany: candidate.currentCompany || '',
                                            experience: candidate.experience || '',
                                            ctc: candidate.ctc ? (candidate.ctc / 100000).toFixed(2) : '',
                                            noticePeriod: candidate.noticePeriod || '',
                                            location: candidate.location || '',
                                            phone: candidate.phone || '',
                                            email: candidate.email || '',
                                            skills: (candidate.skills || []).join(', '),
                                            summary: candidate.summary || '',
                                        })
                                        setIsEditing(true)
                                    }}
                                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-md border border-border bg-card text-foreground font-medium text-[14px] hover:bg-accent shadow-sm transition-all"
                                >
                                    Edit Profile
                                </button>
                                <button
                                    onClick={() => saveMutation.mutate(!candidate.isSaved)}
                                    disabled={saveMutation.isPending}
                                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md border font-medium text-[14px] transition-all shadow-sm ${candidate.isSaved ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-foreground hover:bg-accent'}`}
                                >
                                    <Bookmark className={`w-4 h-4 ${candidate.isSaved ? 'fill-current' : ''}`} />
                                    {candidate.isSaved ? 'Saved' : 'Save'}
                                </button>
                            </div>

                            {isEditing ? (
                                /* ── EDIT FORM ──────────────────────────────── */
                                <div className="mt-2 pr-44">
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="col-span-2">
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Full Name</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.name || ''} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Designation / Title</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.designation || ''} onChange={e => setEditForm((f: any) => ({ ...f, designation: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Current Company</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.currentCompany || ''} onChange={e => setEditForm((f: any) => ({ ...f, currentCompany: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Experience (years)</label>
                                            <input type="number" min="0" className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.experience || ''} onChange={e => setEditForm((f: any) => ({ ...f, experience: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">CTC (in Lakhs)</label>
                                            <input type="number" min="0" step="0.01" className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.ctc || ''} onChange={e => setEditForm((f: any) => ({ ...f, ctc: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Notice Period</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. 30 days" value={editForm.noticePeriod || ''} onChange={e => setEditForm((f: any) => ({ ...f, noticePeriod: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Location</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.location || ''} onChange={e => setEditForm((f: any) => ({ ...f, location: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Phone</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.phone || ''} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Email</label>
                                            <input type="email" className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" value={editForm.email || ''} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Skills (comma-separated)</label>
                                            <input className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="React, Node.js, Python..." value={editForm.skills || ''} onChange={e => setEditForm((f: any) => ({ ...f, skills: e.target.value }))} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Summary</label>
                                            <textarea rows={3} className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" value={editForm.summary || ''} onChange={e => setEditForm((f: any) => ({ ...f, summary: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                const payload: any = {
                                                    name: editForm.name,
                                                    designation: editForm.designation,
                                                    currentCompany: editForm.currentCompany,
                                                    experience: editForm.experience ? Number(editForm.experience) : undefined,
                                                    ctc: editForm.ctc ? Math.round(Number(editForm.ctc) * 100000) : undefined,
                                                    noticePeriod: editForm.noticePeriod,
                                                    location: editForm.location,
                                                    phone: editForm.phone,
                                                    email: editForm.email,
                                                    skills: editForm.skills ? editForm.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
                                                    summary: editForm.summary,
                                                }
                                                editMutation.mutate(payload)
                                            }}
                                            disabled={editMutation.isPending}
                                            className="px-5 py-2 bg-primary text-primary-foreground rounded-md font-bold text-[14px] hover:opacity-90 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            Save Changes
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-5 py-2 bg-muted text-muted-foreground rounded-md font-bold text-[14px] hover:bg-muted/80 shadow-sm transition-all flex items-center gap-2"
                                        >
                                            <X className="w-4 h-4" /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                            <div className="flex gap-6">
                                {/* Circular Avatar */}
                                <div className="shrink-0">
                                    <div className="w-[100px] h-[100px] rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center">
                                        <span className="text-3xl font-bold text-muted-foreground uppercase">{name.charAt(0)}</span>
                                    </div>
                                </div>

                                {/* Header Details */}
                                <div className="flex-1">
                                    <h1 className="text-[22px] font-bold text-foreground mb-2">{name}</h1>

                                    <div className="flex items-center gap-4 mb-4 text-[14px] text-muted-foreground">
                                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <Briefcase className="w-4 h-4 text-muted-foreground/60" /> {experience}
                                        </div>
                                        <span className="text-border">|</span>
                                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <span className="text-muted-foreground/60 font-serif">₹</span> {ctc}
                                        </div>
                                        <span className="text-border">|</span>
                                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <MapPin className="w-4 h-4 text-muted-foreground/60" /> {location}
                                        </div>
                                    </div>

                                    <table className="text-[13px] text-muted-foreground border-separate border-spacing-y-1.5 mb-5">
                                        <tbody>
                                            {previousRole && (
                                                <tr>
                                                    <td className="w-32 align-top pr-2 text-muted-foreground/70">Previous</td>
                                                    <td className="font-semibold text-foreground"><HighlightText text={previousRole} queries={queries} /></td>
                                                </tr>
                                            )}
                                            {highestDegreeStr && (
                                                <tr>
                                                    <td className="w-32 align-top pr-2 text-muted-foreground/70">Highest degree</td>
                                                    <td className="font-semibold text-foreground truncate max-w-[400px] block">{highestDegreeStr}</td>
                                                </tr>
                                            )}
                                            {prefLocations && (
                                                <tr>
                                                    <td className="w-32 align-top pr-2 text-muted-foreground/70">Pref. locations</td>
                                                    <td className="font-semibold text-foreground">{prefLocations}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-4 mb-5">
                                        <button
                                            onClick={() => setShowPhone(!showPhone)}
                                            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-bold text-[14px] hover:opacity-90 shadow-sm transition-all"
                                        >
                                            {showPhone ? (candidate.phone || 'No phone') : 'View phone number'}
                                        </button>
                                        <a
                                            href={`tel:${candidate.phone}`}
                                            className="px-6 py-2.5 bg-background text-foreground border border-border rounded-md font-bold text-[14px] flex items-center gap-2 hover:bg-accent shadow-sm transition-all"
                                        >
                                            <Phone className="w-4 h-4" /> Call
                                        </a>
                                        <a
                                            href={`https://wa.me/${candidate.phone?.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-6 py-2.5 bg-[#25D366] text-white border border-[#25D366] rounded-md font-bold text-[14px] flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                                            Chat
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-3 text-[13px] text-muted-foreground/60">
                                        <div className="flex items-center gap-1.5">
                                            <Mail className="w-4 h-4 opacity-70" /> {email}
                                        </div>
                                        <span className="text-border">•</span>
                                        <span className="italic">Verified phone & email</span>
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Visual Experience Timeline */}
                        <div className="border-t border-border bg-muted/30 px-6 py-4">
                            <div className="relative pt-6 pb-2">
                                <div className="absolute top-[34px] left-0 right-0 h-[4px] bg-gradient-to-r from-blue-400 to-purple-400 rounded-full z-0 opacity-50"></div>
                                <div className="absolute top-[34px] right-0 w-[15%] h-[4px] border-b-2 border-dashed border-border bg-muted/10 z-0"></div>

                                <div className="relative z-10 flex justify-between px-2">
                                    <div className="flex flex-col items-center">
                                        <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-1 shadow-sm">
                                            <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
                                        </div>
                                        <span className="text-[11px] text-gray-500">Education</span>
                                    </div>

                                    {workExperience.length > 0 ? (
                                        // Dynamic Timeline Markers from structured history
                                        workExperience.slice(0, 3).reverse().map((exp: any, i: number) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <div className={`w-6 h-6 rounded-full bg-card border-2 ${i === 2 ? 'border-primary' : 'border-blue-400'} flex items-center justify-center mb-1 shadow-sm`}>
                                                    <Briefcase className={`w-3.5 h-3.5 ${i === 2 ? 'text-primary' : 'text-blue-400'}`} />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                                                    {exp.company || 'Job'}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            <div className="flex flex-col items-center ml-[-20px]">
                                                <div className="w-6 h-6 rounded-full bg-card border-2 border-blue-400 flex items-center justify-center mb-1 shadow-sm">
                                                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">Previous</span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="w-6 h-6 rounded-full bg-card border-2 border-primary flex items-center justify-center mb-1 shadow-sm">
                                                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">Current</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex flex-col items-center placeholder-marker mr-[-20px]">
                                        <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-1 shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                        </div>
                                        <span className="text-[11px] text-gray-500">Applied</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-1 h-1 rounded-full bg-transparent mt-2.5 mb-2.5"></div>
                                        <span className="text-[11px] text-gray-400">till date</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Status Footer */}
                        <div className="border-t border-border bg-card px-6 py-2.5 flex justify-between items-center text-[12px] text-muted-foreground/60">
                            <div className="flex gap-4">
                                <span>Active Profile</span>
                                <span>|</span>
                                <span>Contacted</span>
                            </div>
                            <div className="flex gap-4">
                                <span>Last modified: {candidate.updatedAt ? new Date(candidate.updatedAt).toLocaleDateString() : 'Recently'}</span>
                            </div>
                        </div>
                    </div>


                    {/* CARD 2: Main Content Tabs */}
                    <div className="bg-card rounded-lg border border-border shadow-sm mb-10 overflow-hidden">

                        {/* Tabs */}
                        <div className="flex border-b border-border px-6 pt-2">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`px-4 py-3 font-semibold text-[15px] border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                Profile detail
                            </button>
                            <button
                                onClick={() => { setActiveTab('cv'); setCvError(false); setCvBlobUrl(null); setMaskPii(false) }}
                                className={`px-4 py-3 font-medium text-[15px] border-b-2 transition-colors ${activeTab === 'cv' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            >
                                Attached CV
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="px-6 py-8">

                            {activeTab === 'details' ? (
                                <div className="space-y-10">

                                    {/* Summary Box */}
                                    {summaryText && (
                                        <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded-r-[4px] p-4 text-[13px] text-muted-foreground leading-relaxed relative">
                                            <HighlightText
                                                text={summaryText}
                                                queries={queries}
                                            />
                                        </div>
                                    )}

                                    {/* Key Skills */}
                                    {keySkills.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-foreground mb-3">Key skills</h3>
                                            <div className="flex flex-wrap gap-2">
                                                <HighlightArray items={keySkills} queries={queries} />
                                            </div>
                                        </div>
                                    )}

                                    {mayAlsoKnow.length > 0 && (
                                        <div>
                                            <h3 className="text-[14px] font-bold text-foreground mb-3">May also know</h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <HighlightArray items={mayAlsoKnow} queries={queries} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Projects Section */}
                                    {projects.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-foreground mb-4">Projects</h3>
                                            <div className="space-y-6">
                                                {projects.map((proj: any, idx: number) => (
                                                    <div key={idx} className="flex gap-4 p-2 relative group hover:bg-muted/50 rounded-lg transition-colors">
                                                        <div className="w-10 h-10 shrink-0 bg-purple-500/10 border border-purple-500/20 rounded-[4px] flex items-center justify-center overflow-hidden p-1">
                                                            <FileText className="w-4 h-4 text-purple-500" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-[15px] font-bold text-foreground mb-1">
                                                                <HighlightText text={proj.name} queries={queries} />
                                                            </h4>
                                                            <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">
                                                                <HighlightText text={proj.description || ''} queries={queries} />
                                                            </p>
                                                            {proj.technologies && proj.technologies.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {proj.technologies.map((tech: string, i: number) => (
                                                                        <span key={i} className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded transition-colors">
                                                                            <HighlightText text={tech} queries={queries} />
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Work Summary */}
                                    {(summaryText || candidate.designation || candidate.industry) && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-foreground mb-3">Work summary</h3>
                                            {summaryText && (
                                                <p className="text-[14px] text-muted-foreground mb-4 leading-relaxed">
                                                    <HighlightText text={summaryText} queries={queries} />
                                                </p>
                                            )}
                                            <table className="text-[14px] text-muted-foreground border-separate border-spacing-y-2">
                                                <tbody>
                                                    {candidate.industry && (
                                                        <tr><td className="w-32 text-muted-foreground/60">Industry</td><td className="font-semibold text-foreground">{candidate.industry}</td></tr>
                                                    )}
                                                    {candidate.designation && (
                                                        <tr><td className="w-32 text-muted-foreground/60">Role</td><td className="font-semibold text-foreground">{candidate.designation}</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Work Experience */}
                                    {(workExperience.length > 0 || previousRole || candidate.experience || candidate.location) && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-foreground mb-4">Work experience</h3>

                                            <div className="relative mb-8 px-2 h-0.5 w-[85%] bg-gradient-to-r from-blue-400 to-purple-400 mt-4 flex justify-between items-center z-10 opacity-30">
                                                <div className="absolute right-[-15%] w-[15%] h-[2px] border-b-2 border-dashed border-border"></div>
                                            </div>

                                            <div className="space-y-6 mt-8">
                                                {workExperience.length > 0 ? (
                                                    workExperience.map((exp: any, idx: number) => (
                                                        <div key={idx} className="flex gap-4 p-2 relative group hover:bg-muted/50 rounded-lg transition-colors">
                                                            <div className="w-10 h-10 shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-[4px] flex items-center justify-center overflow-hidden p-1">
                                                                <Briefcase className="w-4 h-4 text-blue-500" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start mb-0.5">
                                                                    <h4 className="text-[15px] font-bold text-foreground">
                                                                        <HighlightText text={`${exp.title}${exp.company ? ' at ' + exp.company : ''}`} queries={queries} />
                                                                    </h4>
                                                                    <span className="text-[12px] text-muted-foreground font-medium">
                                                                        {exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                                                                        {' - '}
                                                                        {exp.isCurrent ? 'Present' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[13px] text-muted-foreground mb-2 leading-relaxed">
                                                                    <HighlightText text={exp.description || ''} queries={queries} />
                                                                </p>
                                                                {exp.highlights && exp.highlights.length > 0 && (
                                                                    <ul className="list-disc pl-4 space-y-1 text-[12px] text-muted-foreground/70">
                                                                        {exp.highlights.map((h: string, i: number) => (
                                                                            <li key={i}><HighlightText text={h} queries={queries} /></li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex gap-4 p-2 relative group hover:bg-muted/50 rounded-lg transition-colors">
                                                        <div className="w-10 h-10 shrink-0 bg-blue-500/10 border border-blue-500/20 rounded-[4px] flex items-center justify-center overflow-hidden p-1">
                                                            <Briefcase className="w-4 h-4 text-blue-500" />
                                                        </div>
                                                        <div>
                                                            {previousRole && (
                                                                <h4 className="text-[15px] font-bold text-foreground mb-0.5">
                                                                    <HighlightText text={previousRole} queries={queries} />
                                                                </h4>
                                                            )}
                                                            {candidate.experience && <p className="text-[13px] text-muted-foreground">{candidate.experience} Years Experience</p>}
                                                            {candidate.location && <p className="text-[13px] text-muted-foreground">{candidate.location}</p>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Education */}
                                    {qualsList.length > 0 && (
                                        <div>
                                            <h3 className="text-[16px] font-bold text-foreground mb-4">Education</h3>
                                            <div className="space-y-4">
                                                {educationEntries.length > 0 ? (
                                                    educationEntries.map((edu: any, i: number) => (
                                                        <div key={i} className="flex gap-4 p-2 group hover:bg-muted/50 rounded-lg transition-colors">
                                                            <div className="w-10 h-10 shrink-0 bg-orange-500/10 border border-orange-500/20 rounded-[4px] flex items-center justify-center shadow-sm">
                                                                <GraduationCap className="w-5 h-5 text-orange-500" />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-[15px] font-bold text-foreground mb-0.5">
                                                                    <HighlightText text={`${edu.degree}${edu.field ? ' in ' + edu.field : ''}`} queries={queries} />
                                                                </h4>
                                                                <p className="text-[13px] text-foreground font-medium">{edu.institution}</p>
                                                                <p className="text-[12px] text-muted-foreground">
                                                                    {edu.startDate ? new Date(edu.startDate).getFullYear() : ''}
                                                                    {edu.endDate ? ` - ${new Date(edu.endDate).getFullYear()}` : ''}
                                                                    {edu.score ? ` | Score: ${edu.score}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex gap-4 p-2 group hover:bg-muted/50 rounded-lg transition-colors">
                                                        <div className="w-10 h-10 shrink-0 bg-orange-500/10 border border-orange-500/20 rounded-[4px] flex items-center justify-center shadow-sm">
                                                            <GraduationCap className="w-5 h-5 text-orange-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[15px] font-bold text-foreground mb-0.5">
                                                                {highestDegreeStr}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Other Details */}
                                    {(candidate.dob || candidate.noticePeriod || candidate.alternativeMobile) && (
                                        <div className="pt-6 border-t border-[#e2e8f0] space-y-8">
                                            <h3 className="text-[16px] font-bold text-foreground">Other details</h3>

                                            {(candidate.dob || candidate.age || candidate.linkedin || candidate.github || candidate.portfolio) && (
                                                <div>
                                                    <h4 className="text-[14px] font-bold text-foreground mb-3">Personal & Social details</h4>
                                                    <div className="grid grid-cols-4 gap-4 text-[13px]">
                                                        {candidate.dob && (
                                                            <div>
                                                                <p className="text-muted-foreground/60 mb-1">Date of Birth</p>
                                                                <p className="font-semibold text-foreground">{new Date(candidate.dob).toLocaleDateString()}</p>
                                                            </div>
                                                        )}
                                                        {candidate.age && (
                                                            <div>
                                                                <p className="text-muted-foreground/60 mb-1">Age</p>
                                                                <p className="font-semibold text-foreground">{candidate.age} Years</p>
                                                            </div>
                                                        )}
                                                        {candidate.linkedin && (
                                                            <div>
                                                                <p className="text-gray-400 mb-1">LinkedIn</p>
                                                                <p className="font-medium text-[#275df5] truncate"><a href={candidate.linkedin} target="_blank" rel="noopener noreferrer">View Profile</a></p>
                                                            </div>
                                                        )}
                                                        {candidate.github && (
                                                            <div>
                                                                <p className="text-gray-400 mb-1">GitHub</p>
                                                                <p className="font-medium text-[#275df5] truncate"><a href={candidate.github} target="_blank" rel="noopener noreferrer">View GitHub</a></p>
                                                            </div>
                                                        )}
                                                        {candidate.portfolio && (
                                                            <div>
                                                                <p className="text-gray-400 mb-1">Portfolio</p>
                                                                <p className="font-medium text-[#275df5] truncate"><a href={candidate.portfolio} target="_blank" rel="noopener noreferrer">View Portfolio</a></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {(candidate.noticePeriod !== undefined || candidate.alternativeMobile) && (
                                                <div>
                                                    <h4 className="text-[14px] font-bold text-foreground mb-3">Job & Contact details</h4>
                                                    <div className="grid grid-cols-4 gap-4 text-[13px]">
                                                        {candidate.noticePeriod !== undefined && (
                                                            <div>
                                                                <p className="text-muted-foreground/60 mb-1">Notice Period</p>
                                                                <p className="font-semibold text-foreground">{candidate.noticePeriod} Days</p>
                                                            </div>
                                                        )}
                                                        {candidate.alternativeMobile && (
                                                            <div>
                                                                <p className="text-muted-foreground/60 mb-1">Alternative Mobile</p>
                                                                <p className="font-semibold text-foreground">{candidate.alternativeMobile}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Appended Extracted Summary to Details Tab */}
                                    <div className="pt-8 border-t border-border mt-8">
                                        <h3 className="text-[16px] font-bold text-foreground mb-4">Extracted Summary (from Resume)</h3>
                                        <ResumeView />
                                    </div>

                                </div>
                            ) : (
                                /* Attached CV Tab Content */
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[16px] font-bold text-foreground">Attached CV</h3>
                                        <span className="text-[12px] text-gray-400">Last updated on {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg border border-border p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                id="mask"
                                                checked={maskPii}
                                                onChange={e => setMaskPii(e.target.checked)}
                                                className="w-4 h-4 rounded border-border cursor-pointer"
                                            />
                                            <label htmlFor="mask" className="cursor-pointer select-none">
                                                {cvLoading && maskPii !== false ? 'Masking...' : 'Mask personal information'}
                                            </label>
                                            <div className="w-4 h-4 border border-muted-foreground/40 rounded-full flex items-center justify-center text-[10px] text-muted-foreground font-bold ml-1" title="Hides email, phone and social links from the CV preview and download">
                                                i
                                            </div>
                                        </div>
                                        <a
                                            href={(candidate.resumePdfVersion || candidate.resumeFile) ? `/api/files/view/${candidate.resumePdfVersion || candidate.resumeFile}${maskPii ? '?mask=true' : ''}` : '#'}
                                            target="_blank"
                                            rel="noopener"
                                            className="px-6 py-2.5 bg-primary text-primary-foreground border border-primary rounded-md font-bold text-[14px] flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
                                        >
                                            <Download className="w-4 h-4" /> Download CV
                                        </a>
                                    </div>

                                    {/* CV Preview — blob URL approach avoids iframe auth/cookie issues */}
                                    {(() => {
                                        const hasPdf = !!(candidate.resumePdfVersion ||
                                            /\.pdf$/i.test(candidate.resumeFilename || candidate.resumeFile || ''))
                                        const isNonPdf = candidate.resumeFile && !hasPdf
                                        const noFile = !candidate.resumeFile
                                        return (
                                            <div className="mt-6 border border-border rounded-lg overflow-hidden bg-muted/20" style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                                                {noFile ? (
                                                    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                                                        <FileText className="w-16 h-16 text-muted-foreground/20 mb-4" />
                                                        <p className="text-muted-foreground">No resume file attached to this candidate.</p>
                                                    </div>
                                                ) : isNonPdf ? (
                                                    <div className="flex flex-col items-center justify-center h-full p-12 text-center gap-4">
                                                        <FileText className="w-16 h-16 text-muted-foreground/20" />
                                                        <p className="text-muted-foreground text-sm">This CV is in {(candidate.resumeFilename || candidate.resumeFile || '').split('.').pop()?.toUpperCase()} format — preview not available.</p>
                                                        <a href={`/api/files/download/${candidate.resumePdfVersion || candidate.resumeFile}`} target="_blank" rel="noopener noreferrer"
                                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 flex items-center gap-2">
                                                            <Download className="w-4 h-4" /> Download to View
                                                        </a>
                                                    </div>
                                                ) : cvLoading ? (
                                                    <div className="flex items-center justify-center h-full">
                                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : cvError ? (
                                                    <div className="flex flex-col items-center justify-center h-full p-12 text-center gap-4">
                                                        <FileText className="w-16 h-16 text-muted-foreground/20" />
                                                        <p className="text-muted-foreground text-sm">Unable to load the CV preview.</p>
                                                        <a href={`/api/files/download/${candidate.resumePdfVersion || candidate.resumeFile}`} target="_blank" rel="noopener noreferrer"
                                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 flex items-center gap-2">
                                                            <Download className="w-4 h-4" /> Open / Download CV
                                                        </a>
                                                    </div>
                                                ) : cvBlobUrl ? (
                                                    <iframe
                                                        key={cvBlobUrl}
                                                        src={`${cvBlobUrl}#toolbar=0&navpanes=0`}
                                                        className="w-full h-full border-none"
                                                        title="Resume Document"
                                                    />
                                                ) : null}
                                            </div>
                                        )
                                    })()}
                                    <div className="mt-4 flex justify-center">
                                        <a
                                            href={(candidate.resumePdfVersion || candidate.resumeFile) ? `/api/files/view/${candidate.resumePdfVersion || candidate.resumeFile}${maskPii ? '?mask=true' : ''}` : '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                                        >
                                            <ExternalLink className="w-4 h-4" /> Open resume in new tab
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    )
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={
            <AppShell>
                <div className="flex items-center justify-center min-h-screen bg-background">
                    <p className="text-muted-foreground">Loading profile...</p>
                </div>
            </AppShell>
        }>
            <CandidateDetailContent params={params} />
        </Suspense>
    )
}
