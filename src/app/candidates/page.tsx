'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, X, Upload, Loader2, Mail, Download, Briefcase, CheckSquare, LayoutGrid, List, AlignJustify, Clock, ChevronUp, Phone, FileText, MessageSquare, Bell } from 'lucide-react'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
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
    const [minExp, setMinExp] = useState('')
    const [maxExp, setMaxExp] = useState('')
    const [locationFilter, setLocationFilter] = useState('')
    const [minCTC, setMinCTC] = useState('')
    const [maxCTC, setMaxCTC] = useState('')
    const [maxNotice, setMaxNotice] = useState('')
    const [skillsFilter, setSkillsFilter] = useState('')
    const [designationFilter, setDesignationFilter] = useState('')
    const [companyFilter, setCompanyFilter] = useState('')
    const [industryFilter, setIndustryFilter] = useState('')
    const [noticePeriodPill, setNoticePeriodPill] = useState('')
    const [ugQual, setUgQual] = useState('')
    const [pgQual, setPgQual] = useState('')
    const [showEmployment, setShowEmployment] = useState(true)
    const [showEducation, setShowEducation] = useState(true)
    const [hasSearched, setHasSearched] = useState(false)
    const [recentSearches, setRecentSearches] = useState<any[]>([])
    const [showAddTo, setShowAddTo] = useState(false)
    const [hideProfiles, setHideProfiles] = useState(false)
    const [keywordInResults, setKeywordInResults] = useState('')
    const [sortBy, setSortBy] = useState('Relevance')
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ exp: true, salary: true })
    const toggleSection = (key: string) => setOpenSections(p => ({ ...p, [key]: !p[key] }))
    const [activeIn, setActiveIn] = useState('6 months')
    const [showActiveInDrop, setShowActiveInDrop] = useState(false)
    const [showSortDrop, setShowSortDrop] = useState(false)
    const [deptRoleFilter, setDeptRoleFilter] = useState('')
    const [degreeFilter, setDegreeFilter] = useState('')
    const [collegeFilter, setCollegeFilter] = useState('')
    const [gradYearFilter, setGradYearFilter] = useState('')
    const [appliedFilters, setAppliedFilters] = useState({
        search: '', status: '', minExp: '', maxExp: '',
        location: '', minCTC: '', maxCTC: '', maxNotice: '', skills: '',
        designation: '', company: ''
    })

    useEffect(() => {
        try {
            const stored = localStorage.getItem('candidate_recent_searches')
            if (stored) setRecentSearches(JSON.parse(stored))
        } catch {}
    }, [])
    const [page, setPage] = useState(1)
    const [showCreate, setShowCreate] = useState(false)
    const [parsing, setParsing] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const [view, setView] = useState<'compact' | 'list' | 'details'>('compact')

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
        queryKey: ['candidates', appliedFilters, page],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (appliedFilters.status) params.set('status', appliedFilters.status)
            if (appliedFilters.search) params.set('search', appliedFilters.search)
            if (appliedFilters.minExp) params.set('minExp', appliedFilters.minExp)
            if (appliedFilters.maxExp) params.set('maxExp', appliedFilters.maxExp)
            if (appliedFilters.location) params.set('location', appliedFilters.location)
            if (appliedFilters.minCTC) params.set('minCTC', String(Number(appliedFilters.minCTC) * 100000))
            if (appliedFilters.maxCTC) params.set('maxCTC', String(Number(appliedFilters.maxCTC) * 100000))
            if (appliedFilters.maxNotice) params.set('maxNotice', appliedFilters.maxNotice)
            if (appliedFilters.skills) params.set('skills', appliedFilters.skills)
            if ((appliedFilters as any).designation) params.set('designation', (appliedFilters as any).designation)
            if ((appliedFilters as any).company) params.set('company', (appliedFilters as any).company)
            params.set('page', page.toString())
            params.set('limit', '30')
            const res = await apiFetch(`/api/candidates?${params}`)
            return res.json()
        },
    })

    // Map notice period pill to maxNotice days
    const noticePillToMaxNotice = (pill: string) => {
        if (pill === '15') return '15'
        if (pill === '30') return '30'
        if (pill === '60') return '60'
        if (pill === '90') return '90'
        return ''
    }

    const handleSearch = () => {
        const filters = {
            search, status: statusFilter, minExp, maxExp,
            location: locationFilter, minCTC, maxCTC,
            maxNotice: noticePillToMaxNotice(noticePeriodPill),
            skills: skillsFilter, designation: designationFilter, company: companyFilter
        }
        setAppliedFilters(filters)
        setPage(1)
        setHasSearched(true)
        // Save to recent searches
        const parts = [
            skillsFilter && `Skills: ${skillsFilter}`,
            (minExp || maxExp) && `Exp: ${minExp||'0'}-${maxExp||'∞'} yrs`,
            locationFilter && locationFilter,
            (minCTC || maxCTC) && `${minCTC||'0'}-${maxCTC||'∞'} Lacs`,
            noticePeriodPill && `Notice ≤ ${noticePeriodPill}d`,
            designationFilter && designationFilter,
            companyFilter && companyFilter,
        ].filter(Boolean)
        if (parts.length > 0) {
            const label = parts.join(' | ')
            const entry = { label, filters }
            setRecentSearches(prev => {
                const updated = [entry, ...prev.filter(r => r.label !== label)].slice(0, 5)
                try { localStorage.setItem('candidate_recent_searches', JSON.stringify(updated)) } catch {}
                return updated
            })
        }
    }

    const fillSearch = (entry: any) => {
        const f = entry.filters
        setSearch(f.search || ''); setStatusFilter(f.status || '')
        setMinExp(f.minExp || ''); setMaxExp(f.maxExp || '')
        setLocationFilter(f.location || ''); setMinCTC(f.minCTC || ''); setMaxCTC(f.maxCTC || '')
        setSkillsFilter(f.skills || ''); setDesignationFilter(f.designation || ''); setCompanyFilter(f.company || '')
    }

    const handleClearFilters = () => {
        setSearch(''); setStatusFilter(''); setMinExp(''); setMaxExp('')
        setLocationFilter(''); setMinCTC(''); setMaxCTC(''); setMaxNotice(''); setSkillsFilter('')
        setDesignationFilter(''); setCompanyFilter(''); setIndustryFilter('')
        setNoticePeriodPill(''); setUgQual(''); setPgQual('')
        setAppliedFilters({ search: '', status: '', minExp: '', maxExp: '', location: '', minCTC: '', maxCTC: '', maxNotice: '', skills: '', designation: '', company: '' })
        setHasSearched(false)
        setPage(1)
    }

    const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length

    const candidates = data?.candidates ?? []
    const total = data?.total ?? 0
    const totalPages = data?.totalPages ?? 1

    // Active-in filter + sort applied client-side
    const activeInDays: number | null = activeIn === '1 month' ? 30 : activeIn === '3 months' ? 90 : activeIn === '1 year' ? 365 : activeIn === 'Any' ? null : 180
    const displayCandidates = [...candidates]
        .filter((c: any) => {
            if (!activeInDays) return true
            const t = new Date(c.updatedAt || c.createdAt).getTime()
            return (Date.now() - t) <= activeInDays * 86400000
        })
        .sort((a: any, b: any) => {
            if (sortBy === 'Experience') return (Number(b.experience) || 0) - (Number(a.experience) || 0)
            if (sortBy === 'Modified date') return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
            if (sortBy === 'CTC') return (Number(b.ctc) || 0) - (Number(a.ctc) || 0)
            return 0
        })

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
            <div className="min-h-screen bg-background">
                {!hasSearched && (<>
                {/* Tab bar */}
                <div className="border-b border-border bg-background">
                    <div className="max-w-5xl mx-auto px-6 flex items-center">
                        <button className="px-0 py-3.5 text-sm font-medium border-b-2 border-primary text-primary mr-8">
                            Search candidates
                        </button>
                        <button onClick={() => setShowCreate(true)} className="px-0 py-3.5 text-sm text-muted-foreground hover:text-foreground">
                            Add Candidate
                        </button>
                    </div>
                </div>

                {/* Two columns */}
                <div className="max-w-5xl mx-auto px-6 pt-8 pb-6 flex gap-12">

                    {/* LEFT: Search form */}
                    <div className="flex-1">
                        <h1 className="text-[1.875rem] font-bold mb-7">Search candidates</h1>

                        {/* Keywords */}
                        <div className="mb-5">
                            <label className="text-sm font-medium mb-1.5 block">Keywords</label>
                            <input
                                value={skillsFilter}
                                onChange={(e) => setSkillsFilter(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Enter keywords like skills, designation and company"
                                className="w-full px-4 py-3 text-sm border border-border rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                            />
                        </div>

                        {/* Experience */}
                        <div className="mb-5">
                            <label className="text-sm font-medium mb-2.5 block">Experience</label>
                            <div className="flex items-center gap-3">
                                <input type="number" value={minExp} onChange={(e) => setMinExp(e.target.value)}
                                    placeholder="Min experience" min="0" step="0.5"
                                    className="w-44 px-4 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                <span className="text-sm text-muted-foreground">to</span>
                                <input type="number" value={maxExp} onChange={(e) => setMaxExp(e.target.value)}
                                    placeholder="Max experience" min="0" step="0.5"
                                    className="w-44 px-4 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                <span className="text-sm text-muted-foreground">Years</span>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="mb-5">
                            <label className="text-sm font-medium mb-2.5 block">Current location of candidate</label>
                            <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                                placeholder="Add location"
                                className="w-full px-4 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                        </div>

                        {/* Annual Salary */}
                        <div className="mb-6">
                            <label className="text-sm font-medium mb-2.5 block">Annual Salary</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground border border-border rounded px-3 py-2.5 bg-muted/40 shrink-0">INR</span>
                                <input type="number" value={minCTC} onChange={(e) => setMinCTC(e.target.value)}
                                    placeholder="Min salary" min="0"
                                    className="w-36 px-4 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                <span className="text-sm text-muted-foreground">to</span>
                                <input type="number" value={maxCTC} onChange={(e) => setMaxCTC(e.target.value)}
                                    placeholder="Max salary" min="0"
                                    className="w-36 px-4 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                <span className="text-sm text-muted-foreground">Lacs</span>
                            </div>
                        </div>

                        {/* Employment Details */}
                        <div className="border-t border-border pt-5 mb-4">
                            <button onClick={() => setShowEmployment(v => !v)}
                                className="w-full flex items-center justify-between text-left mb-0.5">
                                <h2 className="text-[0.9375rem] font-semibold">Employment Details</h2>
                                <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showEmployment ? '' : 'rotate-180'}`} />
                            </button>
                            {showEmployment && (
                                <div className="mt-5 space-y-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block">Industry</label>
                                        <input value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}
                                            placeholder="Add industry"
                                            className="w-full px-3 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block">Company</label>
                                        <input value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
                                            placeholder="Add company name"
                                            className="w-full px-3 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-1.5 block">Designation</label>
                                        <input value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}
                                            placeholder="Add designation"
                                            className="w-full px-3 py-2.5 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-2 block">Notice Period / Availability to join ⓘ</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { label: 'Any', value: '' },
                                                { label: '0 - 15 days', value: '15' },
                                                { label: '1 month', value: '30' },
                                                { label: '2 months', value: '60' },
                                                { label: '3 months', value: '90' },
                                                { label: 'More than 3 months', value: '999' },
                                            ].map(opt => (
                                                <button key={opt.value}
                                                    onClick={() => setNoticePeriodPill(noticePeriodPill === opt.value ? '' : opt.value)}
                                                    className={`px-4 py-1.5 text-xs border rounded-full transition-colors ${(noticePeriodPill === opt.value) || (opt.value === '' && noticePeriodPill === '') ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-border text-foreground hover:border-blue-300'}`}>
                                                    {opt.label}{noticePeriodPill === opt.value && opt.value !== '' ? ' ×' : ' +'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Education Details */}
                        <div className="border-t border-border pt-5 mb-8">
                            <button onClick={() => setShowEducation(v => !v)}
                                className="w-full flex items-center justify-between text-left mb-0.5">
                                <h2 className="text-[0.9375rem] font-semibold">Education Details</h2>
                                <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${showEducation ? '' : 'rotate-180'}`} />
                            </button>
                            {showEducation && (
                                <div className="mt-5 space-y-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-2 block">UG Qualification</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Any UG qualification', 'Specific UG qualification', 'No UG qualification'].map(opt => (
                                                <button key={opt} onClick={() => setUgQual(ugQual === opt ? '' : opt)}
                                                    className={`px-4 py-1.5 text-xs border rounded-full transition-colors ${ugQual === opt ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-border text-foreground hover:border-blue-300'}`}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground mb-2 block">PG Qualification</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Any PG qualification', 'Specific PG qualification', 'No PG qualification'].map(opt => (
                                                <button key={opt} onClick={() => setPgQual(pgQual === opt ? '' : opt)}
                                                    className={`px-4 py-1.5 text-xs border rounded-full transition-colors ${pgQual === opt ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-border text-foreground hover:border-blue-300'}`}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom row: Active in + Search button */}
                        <div className="flex items-center justify-between border-t border-border pt-4">
                            <div className="relative">
                                <button onClick={() => setShowActiveInDrop(v => !v)}
                                    className="text-sm text-muted-foreground flex items-center gap-1.5 border border-border rounded px-3 py-2 hover:bg-muted/40">
                                    Active in — <span className="font-medium">{activeIn}</span>
                                    <ChevronUp className={`h-3.5 w-3.5 ml-0.5 transition-transform ${showActiveInDrop ? '' : 'rotate-180'}`} />
                                </button>
                                {showActiveInDrop && (
                                    <div className="absolute bottom-full left-0 mb-1 z-20 bg-background border border-border rounded shadow-lg w-40">
                                        {['1 month', '3 months', '6 months', '1 year', 'Any'].map(opt => (
                                            <button key={opt} onClick={() => { setActiveIn(opt); setShowActiveInDrop(false) }}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${activeIn === opt ? 'font-semibold text-blue-600' : ''}`}>
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={handleSearch}
                                className="px-8 py-2.5 bg-[#4A90D9] hover:bg-[#3a80c9] text-white rounded font-medium text-sm transition-colors">
                                Search candidates
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Recent Searches */}
                    <div className="w-64 shrink-0 pt-1">
                        <h2 className="text-base font-semibold flex items-center gap-2 mb-5">
                            <Clock className="h-4 w-4" /> Recent Searches
                        </h2>
                        {recentSearches.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No recent searches</p>
                        ) : (
                            <div className="space-y-5">
                                {recentSearches.map((s: any, i: number) => (
                                    <div key={i} className="border-b border-border pb-5">
                                        <p className="text-sm mb-2 leading-snug">{s.label}</p>
                                        <div className="flex gap-3">
                                            <button onClick={() => fillSearch(s)} className="text-xs text-blue-600 hover:underline">Fill this search</button>
                                            <button onClick={() => { fillSearch(s); handleSearch() }} className="text-xs text-blue-600 hover:underline">Search profiles</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                </>)}

                {/* RESULTS — shown after search */}
                {hasSearched && (
                    <div className="bg-background">
                        {/* Summary bar */}
                        <div className="border-b border-border">
                            <div className="px-6 py-3 flex items-center gap-2 text-sm">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">›</span>
                                <span className="font-medium">Found <span className="font-bold">{total}</span> profile{total !== 1 ? 's' : ''}</span>
                                {[appliedFilters.skills, appliedFilters.designation, appliedFilters.location].filter(Boolean).length > 0 && (
                                    <span className="text-muted-foreground">for ({[appliedFilters.skills, appliedFilters.designation, appliedFilters.location].filter(Boolean).join(' | ')})</span>
                                )}
                                <button onClick={() => setHasSearched(false)} className="text-blue-600 hover:underline ml-1">Modify</button>
                                <button onClick={() => toast.success('Search saved')} className="ml-auto px-4 py-1.5 border border-border rounded text-sm hover:bg-muted">Save Search</button>
                            </div>
                        </div>

                        {/* Two-column layout */}
                        <div className="flex">

                            {/* LEFT sidebar */}
                            <div className="w-[260px] shrink-0 border-r border-border min-h-screen px-4 py-5">
                                <label className="flex items-center gap-2 text-sm cursor-pointer pb-4 border-b border-border">
                                    <input type="checkbox" checked={hideProfiles} onChange={e => setHideProfiles(e.target.checked)}
                                        className="h-4 w-4 rounded border-border" />
                                    Hide Profiles
                                </label>

                                <div className="pt-4 pb-3 border-b border-border flex items-center justify-between">
                                    <h3 className="text-sm font-semibold flex items-center gap-1.5">≡ Filters
                                        {activeFilterCount > 0 && <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded font-medium ml-1">New</span>}
                                    </h3>
                                    {activeFilterCount > 0 && (
                                        <button onClick={handleClearFilters} className="text-xs text-blue-600 hover:underline">Reset</button>
                                    )}
                                </div>

                                {activeFilterCount > 0 && (
                                    <div className="py-3 border-b border-border">
                                        <p className="text-xs text-muted-foreground mb-2">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {appliedFilters.skills && appliedFilters.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                                                <span key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 border border-border rounded">
                                                    {s.toUpperCase()}
                                                    <button onClick={() => { const u = appliedFilters.skills.split(',').map((x:string)=>x.trim()).filter((x:string)=>x!==s).join(', '); setSkillsFilter(u); setAppliedFilters(f=>({...f,skills:u})) }}>×</button>
                                                </span>
                                            ))}
                                            {appliedFilters.location && <span className="flex items-center gap-1 text-xs px-2 py-0.5 border border-border rounded">{appliedFilters.location} <button onClick={()=>{setLocationFilter('');setAppliedFilters(f=>({...f,location:''}))}} >×</button></span>}
                                        </div>
                                    </div>
                                )}

                                <label className="flex items-center gap-2 text-sm cursor-pointer py-3 border-b border-border">
                                    <input type="checkbox" className="h-4 w-4 rounded border-border" />
                                    Premium Institute Candidates
                                </label>

                                {[
                                    { label: 'Keywords', key: 'keywords', content: (
                                        <div className="relative mt-2">
                                            <input value={keywordInResults} onChange={e => setKeywordInResults(e.target.value)}
                                                placeholder="Search keyword"
                                                className="w-full pl-3 pr-8 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                    )},
                                    { label: 'Current company', key: 'company', content: (
                                        <input value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                                            placeholder="Add company" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Location', key: 'location', content: (
                                        <input value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                                            placeholder="Add location" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Experience (Years)', key: 'exp', content: (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input type="number" value={minExp} onChange={e => setMinExp(e.target.value)} placeholder="Min"
                                                className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                            <span className="text-sm text-muted-foreground shrink-0">to</span>
                                            <input type="number" value={maxExp} onChange={e => setMaxExp(e.target.value)} placeholder="Max"
                                                className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                        </div>
                                    )},
                                    { label: 'Salary (INR-Lacs)', key: 'salary', content: (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input type="number" value={minCTC} onChange={e => setMinCTC(e.target.value)} placeholder="Min"
                                                className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                            <span className="text-sm text-muted-foreground shrink-0">to</span>
                                            <input type="number" value={maxCTC} onChange={e => setMaxCTC(e.target.value)} placeholder="Max"
                                                className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                        </div>
                                    )},
                                    { label: 'Current designation', key: 'desig', content: (
                                        <input value={designationFilter} onChange={e => setDesignationFilter(e.target.value)}
                                            placeholder="Add designation" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Department and Role', key: 'dept', content: (
                                        <input value={deptRoleFilter} onChange={e => setDeptRoleFilter(e.target.value)}
                                            placeholder="Add department or role" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Industry', key: 'industry', content: (
                                        <input value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
                                            placeholder="Add industry" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Notice period', key: 'notice', content: (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {[{l:'Any',v:''},{l:'0-15 days',v:'15'},{l:'1 month',v:'30'},{l:'2 months',v:'60'},{l:'3 months',v:'90'},{l:'>3 months',v:'999'}].map(o=>(
                                                <button key={o.v} onClick={()=>setNoticePeriodPill(o.v)}
                                                    className={`px-3 py-1 text-xs border rounded-full ${noticePeriodPill===o.v ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-border hover:border-blue-300'}`}>{o.l}</button>
                                            ))}
                                        </div>
                                    )},
                                    { label: 'Degree/Course', key: 'degree', content: (
                                        <input value={degreeFilter} onChange={e => setDegreeFilter(e.target.value)}
                                            placeholder="e.g. B.Tech, MBA" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'College name', key: 'college', content: (
                                        <input value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}
                                            placeholder="Add college name" className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                    { label: 'Year of degree completion', key: 'gradyr', content: (
                                        <input type="number" value={gradYearFilter} onChange={e => setGradYearFilter(e.target.value)}
                                            placeholder="e.g. 2020" min="1980" max="2030"
                                            className="w-full mt-2 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:border-blue-400" />
                                    )},
                                ].map(({ label, key, content }) => (
                                    <div key={key} className="border-b border-border">
                                        <button onClick={() => toggleSection(key)}
                                            className="w-full flex items-center justify-between py-3 text-sm text-foreground">
                                            <span>{label}</span>
                                            <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${openSections[key] ? '' : 'rotate-180'}`} />
                                        </button>
                                        {openSections[key] && content && <div className="pb-3">{content}</div>}
                                    </div>
                                ))}

                                <button onClick={handleSearch}
                                    className="mt-4 w-full py-2 bg-[#4A90D9] hover:bg-[#3a80c9] text-white rounded text-sm font-medium transition-colors">
                                    Apply filters
                                </button>
                            </div>

                            {/* RIGHT: results */}
                            <div className="flex-1 min-w-0 px-6 py-4">
                                {/* Controls row */}
                                <div className="flex items-center gap-3 mb-4 text-sm flex-wrap">
                                    {/* Active in dropdown */}
                                    <div className="relative">
                                        <button onClick={() => { setShowActiveInDrop(v => !v); setShowSortDrop(false) }}
                                            className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 hover:bg-muted text-sm">
                                            Active in — <span className="font-medium ml-0.5">{activeIn}</span>
                                            <ChevronUp className={`h-3.5 w-3.5 ml-1 transition-transform ${showActiveInDrop ? '' : 'rotate-180'}`} />
                                        </button>
                                        {showActiveInDrop && (
                                            <div className="absolute top-full left-0 mt-1 z-20 bg-background border border-border rounded shadow-lg w-40">
                                                {['1 month', '3 months', '6 months', '1 year', 'Any'].map(opt => (
                                                    <button key={opt} onClick={() => { setActiveIn(opt); setShowActiveInDrop(false) }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${activeIn === opt ? 'font-semibold text-blue-600' : ''}`}>
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="ml-auto flex items-center gap-3">
                                        {/* Sort by dropdown */}
                                        <div className="relative">
                                            <button onClick={() => { setShowSortDrop(v => !v); setShowActiveInDrop(false) }}
                                                className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 hover:bg-muted text-sm">
                                                Sort: <span className="font-medium ml-0.5">{sortBy}</span>
                                                <ChevronUp className={`h-3.5 w-3.5 ml-1 transition-transform ${showSortDrop ? '' : 'rotate-180'}`} />
                                            </button>
                                            {showSortDrop && (
                                                <div className="absolute top-full right-0 mt-1 z-20 bg-background border border-border rounded shadow-lg w-44">
                                                    {['Relevance', 'Modified date', 'Experience', 'CTC'].map(opt => (
                                                        <button key={opt} onClick={() => { setSortBy(opt); setShowSortDrop(false) }}
                                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${sortBy === opt ? 'font-semibold text-blue-600' : ''}`}>
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 border border-border rounded">
                                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                                className="px-2 py-1.5 hover:bg-muted disabled:opacity-40 text-base leading-none">&lsaquo;</button>
                                            <span className="px-2 text-xs text-muted-foreground">{page}/{Math.max(1,totalPages)}</span>
                                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                                className="px-2 py-1.5 hover:bg-muted disabled:opacity-40 text-base leading-none">&rsaquo;</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Bulk action bar */}
                                {selectedIds.size > 0 && (
                                    <div className="flex items-center gap-3 border border-border rounded px-4 py-2.5 mb-4 bg-background relative">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox"
                                                checked={candidates.length > 0 && selectedIds.size === candidates.length}
                                                onChange={toggleSelectAll}
                                                className="h-4 w-4 accent-blue-600 rounded" />
                                            <span className="text-sm font-medium">{selectedIds.size} Selected</span>
                                        </label>
                                        <div className="relative">
                                            <button onClick={() => setShowAddTo(v => !v)}
                                                className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-sm hover:bg-muted">
                                                <FileText className="h-3.5 w-3.5" /> Add to <ChevronUp className={`h-3.5 w-3.5 transition-transform ${showAddTo ? '' : 'rotate-180'}`} />
                                            </button>
                                            {showAddTo && (
                                                <div className="absolute top-full left-0 mt-1 z-20 bg-background border border-border rounded shadow-lg w-44">
                                                    <div className="text-[10px] uppercase text-muted-foreground px-3 pt-2 pb-1 tracking-wide">Actions</div>
                                                    <button onClick={() => { setShowBulkAssign(true); setShowAddTo(false) }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                                                        <Briefcase className="h-3.5 w-3.5" /> Assign to position
                                                    </button>
                                                    <button onClick={() => { setShowBulkEmail(true); setShowAddTo(false) }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                                                        <Mail className="h-3.5 w-3.5" /> Send email
                                                    </button>
                                                    <button onClick={() => { handleBulkExport(); setShowAddTo(false) }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2">
                                                        <Download className="h-3.5 w-3.5" /> Export CSV
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => toast.info('Reminder feature coming soon')}
                                            className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-sm hover:bg-muted">
                                            <Bell className="h-3.5 w-3.5" /> Remind
                                        </button>
                                        <button onClick={() => { setShowBulkEmail(true); clearSelection() }}
                                            className="flex items-center gap-1.5 border border-border rounded px-3 py-1.5 text-sm hover:bg-muted">
                                            <Mail className="h-3.5 w-3.5" /> Email all
                                        </button>
                                        <button onClick={clearSelection} className="ml-2">
                                            <X className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    </div>
                                )}

                                {/* Candidate cards */}
                                <div className="space-y-0">
                                    {displayCandidates.filter((c: any) => !hideProfiles).map((c: any) => {
                                        const skillsList: string[] = Array.isArray(c.skills) ? c.skills : (c.skills ? String(c.skills).split(',').map((s: string) => s.trim()).filter(Boolean) : [])
                                        const qualsList: string[] = Array.isArray(c.qualifications) ? c.qualifications : (c.qualifications ? String(c.qualifications).split(',').map((s: string) => s.trim()).filter(Boolean) : [])
                                        const searchKeywords = (appliedFilters.skills || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                                        return (
                                            <div key={c._id} className={`flex gap-4 border-b border-border py-5 ${selectedIds.has(c._id) ? 'bg-blue-50/40 dark:bg-blue-950/10' : 'hover:bg-muted/20'}`}>
                                                {/* Checkbox */}
                                                <div className="shrink-0 pt-1" onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={selectedIds.has(c._id)} onChange={() => toggleSelect(c._id)}
                                                        className="h-4 w-4 accent-blue-600 rounded cursor-pointer" />
                                                </div>

                                                {/* Main content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start gap-3 mb-1.5">
                                                        <Link href={`/candidates/${c._id}`} className="text-[1.0625rem] font-semibold text-blue-700 hover:underline dark:text-blue-400">
                                                            {c.name}
                                                        </Link>
                                                        {c.experience != null && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-[#f5f0e8] text-[#7a5c2a] font-medium dark:bg-amber-900/30 dark:text-amber-300 whitespace-nowrap">
                                                                {Math.floor(Number(c.experience))}y {Math.round((Number(c.experience) % 1) * 12)}m
                                                            </span>
                                                        )}
                                                    </div>
                                                    {c.designation && (
                                                        <p className="text-sm text-muted-foreground mb-2">{c.designation}{c.currentCompany ? ` at ${c.currentCompany}` : ''}</p>
                                                    )}

                                                    <div className="space-y-1.5 text-sm">
                                                        {c.currentCompany && (
                                                            <div className="flex gap-2">
                                                                <span className="text-muted-foreground w-28 shrink-0">Previous</span>
                                                                <span>{c.currentCompany}</span>
                                                            </div>
                                                        )}
                                                        {qualsList.length > 0 && (
                                                            <div className="flex gap-2">
                                                                <span className="text-muted-foreground w-28 shrink-0">Education</span>
                                                                <span>{qualsList.join(' | ')}</span>
                                                            </div>
                                                        )}
                                                        {c.location && (
                                                            <div className="flex gap-2">
                                                                <span className="text-muted-foreground w-28 shrink-0">Pref. locations</span>
                                                                <span>{c.location}</span>
                                                            </div>
                                                        )}
                                                        {skillsList.length > 0 && (
                                                            <div className="flex gap-2">
                                                                <span className="text-muted-foreground w-28 shrink-0">Key skills</span>
                                                                <span className="flex-1">
                                                                    {skillsList.slice(0,10).map((sk, i) => (
                                                                        <span key={sk}>
                                                                            {i > 0 && <span className="text-muted-foreground mx-1">|</span>}
                                                                            <span className={searchKeywords.some(kw => sk.toLowerCase().includes(kw)) ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                                                                                {sk}
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                    {skillsList.length > 10 && <button className="text-blue-600 hover:underline ml-1 text-xs">...more</button>}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom row */}
                                                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                                                        <Link href={`/candidates/${c._id}`} className="text-blue-600 hover:underline">View profile</Link>
                                                        <span>|</span>
                                                        <button className="hover:underline">Comment</button>
                                                        <button className="hover:underline">Save</button>
                                                        <div className="ml-auto flex items-center gap-3">
                                                            {c.ctc && <span>CTC: {(Number(c.ctc)/100000).toFixed(1)} L</span>}
                                                            {c.noticePeriod && <span>Notice: {c.noticePeriod}d</span>}
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                                                        </div>
                                                    </div>

                                                    {/* Stats bar */}
                                                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground flex-wrap">
                                                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                                                        {c.phone && (
                                                            <a href={`tel:${c.countryCode||'+91'}${c.phone}`}
                                                                className="flex items-center gap-1 hover:text-foreground transition-colors">
                                                                <Phone className="h-3 w-3" /> {c.countryCode || '+91'} {c.phone}
                                                            </a>
                                                        )}
                                                        {c.updatedAt && (
                                                            <span className="ml-auto">
                                                                Active {Math.floor((Date.now()-new Date(c.updatedAt).getTime())/86400000)}d ago
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right action panel */}
                                                <div className="shrink-0 flex flex-col items-center gap-2 w-36">
                                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground border border-border">
                                                        {c.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <Link href={`/candidates/${c._id}`}
                                                        className="w-full text-center px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition-colors">
                                                        View profile
                                                    </Link>
                                                    {c.phone && (
                                                        <a href={`tel:${c.countryCode||'+91'}${c.phone}`}
                                                            className="w-full text-center px-3 py-1.5 text-xs border border-border rounded hover:bg-muted flex items-center justify-center gap-1.5">
                                                            <Phone className="h-3 w-3" /> {c.countryCode || '+91'} {c.phone}
                                                        </a>
                                                    )}
                                                    {c.email && (
                                                        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                                                            <Mail className="h-2.5 w-2.5" /> Verified email
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {displayCandidates.length === 0 && (
                                    <div className="text-center py-20 text-muted-foreground text-sm">No candidates found for this search</div>
                                )}

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-8">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-50">Previous</button>
                                        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-50">Next</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
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
                                    <input type="number" step="any" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" min="0" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">CTC (INR)</label>
                                    <input type="number" step="any" value={form.ctc} onChange={(e) => setForm({ ...form, ctc: e.target.value })}
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
