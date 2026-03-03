'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Search, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-picker'
import { toast } from 'sonner'

const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
]

export default function ClientsPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showCreate, setShowCreate] = useState(false)

    const [form, setForm] = useState({
        companyName: '', gstin: '', locationType: 'office',
        addressLine1: '', addressLine2: '', city: '', state: '', pin: '', country: 'India',
        contactName: '', contactDesignation: '', contactEmail: '', contactMobile: '',
        agreementDate: '', agreementValidTill: '', remarks: '', assignedTo: '',
    })

    // Users list for Assign To dropdown
    const { data: users = [] } = useQuery({
        queryKey: ['users-for-assign'],
        queryFn: async () => {
            const res = await apiFetch('/api/users')
            return res.json()
        },
        enabled: showCreate,
    })

    const { data: clients = [] } = useQuery({
        queryKey: ['clients', statusFilter, search],
        queryFn: async () => {
            const params = new URLSearchParams()
            if (statusFilter) params.set('status', statusFilter)
            if (search) params.set('search', search)
            const res = await apiFetch(`/api/clients?${params}`)
            return res.json()
        },
    })

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiFetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || 'Failed') }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] })
            setShowCreate(false)
            setForm({ companyName: '', gstin: '', locationType: 'office', addressLine1: '', addressLine2: '', city: '', state: '', pin: '', country: 'India', contactName: '', contactDesignation: '', contactEmail: '', contactMobile: '', agreementDate: '', agreementValidTill: '', remarks: '', assignedTo: '' })
            toast.success('Client created successfully')
        },
        onError: (err: any) => toast.error(err.message),
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate({
            companyName: form.companyName,
            gstin: form.gstin,
            locationType: form.locationType,
            address: {
                line1: form.addressLine1, line2: form.addressLine2,
                city: form.city, state: form.state, pin: form.pin, country: form.country,
            },
            contacts: form.contactName ? [{
                name: form.contactName, designation: form.contactDesignation,
                email: form.contactEmail, mobile: form.contactMobile,
            }] : [],
            agreementDate: form.agreementDate || undefined,
            agreementValidTill: form.agreementValidTill || undefined,
            remarks: form.remarks,
            assignedTo: form.assignedTo || undefined,
        })
    }

    const activeCount = clients.filter((c: any) => c.status === 'active').length

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
                            <p className="text-sm text-muted-foreground mt-1">{activeCount} active · {clients.length} total</p>
                        </div>
                        <button onClick={() => setShowCreate(true)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Client
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex gap-3 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                                placeholder="Search clients..." />
                        </div>
                        <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clients.map((client: any) => (
                            <Link key={client._id} href={`/clients/${client._id}`}>
                                <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-all cursor-pointer">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                            <Building2 className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {client.status}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-sm mb-1">{client.companyName}</h3>
                                    <p className="text-xs text-muted-foreground">{client.address?.city}, {client.address?.state}</p>
                                    <p className="text-xs text-muted-foreground mt-1">GSTIN: {client.gstin}</p>
                                    {client.assignedTo && (
                                        <p className="text-xs text-muted-foreground mt-2">Assigned to: {client.assignedTo.name}</p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>

                    {clients.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground text-sm">No clients found</div>
                    )}
                </div>
            </div>

            {/* Create Client Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold">Add New Client</h2>
                            <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Company Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Company Name *</label>
                                    <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">GSTIN *</label>
                                    <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Location Type</label>
                                <Select value={form.locationType} onValueChange={(val) => setForm({ ...form, locationType: val })}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="office">Office</SelectItem>
                                        <SelectItem value="plant">Plant</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Address */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</p>
                                <input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                                    placeholder="Address Line 1 *"
                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                <input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                                    placeholder="Address Line 2"
                                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                <div className="grid grid-cols-3 gap-3">
                                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                                        placeholder="City *" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                    <Select value={form.state} onValueChange={(val) => setForm({ ...form, state: val })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="State *" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <input value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                                        placeholder="PIN *" pattern="[0-9]{6}" maxLength={6} className="px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                                </div>
                            </div>

                            {/* Contact Person */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Person</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                        placeholder="Name" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                    <input value={form.contactDesignation} onChange={(e) => setForm({ ...form, contactDesignation: e.target.value })}
                                        placeholder="Designation" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                    <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                        placeholder="Email" type="email" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                    <input value={form.contactMobile} onChange={(e) => setForm({ ...form, contactMobile: e.target.value })}
                                        placeholder="Mobile" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                                </div>
                            </div>

                            {/* Agreement */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Agreement Date</label>
                                    <div className="mt-1">
                                        <DateInput value={form.agreementDate} onChange={(val) => setForm({ ...form, agreementDate: val })} placeholder="Agreement date" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Agreement Valid Till</label>
                                    <div className="mt-1">
                                        <DateInput value={form.agreementValidTill} onChange={(val) => setForm({ ...form, agreementValidTill: val })} placeholder="Valid till" />
                                    </div>
                                </div>
                            </div>

                            {/* Assign To */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Assign To (TL / Recruiter)</label>
                                <Select value={form.assignedTo || 'unassigned'} onValueChange={(val) => setForm({ ...form, assignedTo: val === 'unassigned' ? '' : val })}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Self (me)</SelectItem>
                                        {users.filter((u: any) => ['team_lead', 'recruiter', 'operations_head', 'super_admin'].includes(u.role)).map((u: any) => (
                                            <SelectItem key={u._id} value={u._id}>{u.name} ({u.role === 'team_lead' ? 'Team Lead' : u.role === 'recruiter' ? 'Recruiter' : u.role === 'operations_head' ? 'Ops Head' : 'Admin'})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Remarks</label>
                                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                    rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y" />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending}
                                    className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50">
                                    {createMutation.isPending ? 'Creating...' : 'Create Client'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    )
}
