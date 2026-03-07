'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState } from 'react'
import {
    ArrowLeft, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight,
    Loader2, Users, UserMinus
} from 'lucide-react'

const COLOR_SWATCHES = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280',
]

export default function CandidateListsPage() {
    const queryClient = useQueryClient()

    // UI state
    const [expandedListId, setExpandedListId] = useState<string | null>(null)
    const [editingListId, setEditingListId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editColor, setEditColor] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('#3B82F6')
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

    // ----- Queries -----
    const { data: lists = [], isLoading } = useQuery<any[]>({
        queryKey: ['candidate-lists'],
        queryFn: async () => {
            const res = await apiFetch('/api/candidate-lists')
            if (!res.ok) throw new Error('Failed to fetch lists')
            return res.json()
        },
    })

    const { data: expandedList, isLoading: isLoadingExpanded } = useQuery<any>({
        queryKey: ['candidate-list', expandedListId],
        queryFn: async () => {
            const res = await apiFetch(`/api/candidate-lists/${expandedListId}`)
            if (!res.ok) throw new Error('Failed to fetch list')
            return res.json()
        },
        enabled: !!expandedListId,
    })

    // ----- Mutations -----
    const createMutation = useMutation({
        mutationFn: async ({ name, color }: { name: string; color: string }) => {
            const res = await apiFetch('/api/candidate-lists', {
                method: 'POST',
                body: JSON.stringify({ name, color }),
            })
            if (!res.ok) throw new Error('Failed to create list')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidate-lists'] })
            setShowCreate(false)
            setNewName('')
            setNewColor('#3B82F6')
            toast.success('List created')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const updateMutation = useMutation({
        mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
            const res = await apiFetch(`/api/candidate-lists/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name, color }),
            })
            if (!res.ok) throw new Error('Failed to update list')
            return res.json()
        },
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['candidate-lists'] })
            queryClient.invalidateQueries({ queryKey: ['candidate-list', updated._id] })
            setEditingListId(null)
            toast.success('List updated')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiFetch(`/api/candidate-lists/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete list')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['candidate-lists'] })
            setConfirmDeleteId(null)
            if (expandedListId === confirmDeleteId) setExpandedListId(null)
            toast.success('List deleted')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    const removeCandidateMutation = useMutation({
        mutationFn: async ({ listId, candidateId }: { listId: string; candidateId: string }) => {
            const res = await apiFetch(`/api/candidate-lists/${listId}/candidates`, {
                method: 'DELETE',
                body: JSON.stringify({ candidateId }),
            })
            if (!res.ok) throw new Error('Failed to remove candidate')
            return res.json()
        },
        onSuccess: (_, { listId }) => {
            queryClient.invalidateQueries({ queryKey: ['candidate-list', listId] })
            queryClient.invalidateQueries({ queryKey: ['candidate-lists'] })
            toast.success('Candidate removed from list')
        },
        onError: (err: Error) => toast.error(err.message),
    })

    return (
        <AppShell>
            <div className="min-h-screen bg-background pb-20 font-sans">
                <div className="max-w-[860px] mx-auto px-4 pt-8 space-y-5">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Link href="/candidates" className="text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-[22px] font-bold text-foreground">Candidate Lists</h1>
                                <p className="text-[13px] text-muted-foreground">{lists.length} list{lists.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreate(v => !v)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-[14px] font-semibold hover:opacity-90 shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" /> New List
                        </button>
                    </div>

                    {/* Create Form */}
                    {showCreate && (
                        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
                            <h3 className="text-[15px] font-bold text-foreground mb-4">Create New List</h3>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1">
                                    <label className="block text-[12px] font-semibold text-muted-foreground mb-1">List Name</label>
                                    <input
                                        autoFocus
                                        className="w-full border border-border rounded-md px-3 py-2 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        placeholder="e.g. Top SAP Candidates"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && newName.trim()) createMutation.mutate({ name: newName.trim(), color: newColor })
                                            if (e.key === 'Escape') setShowCreate(false)
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Color</label>
                                    <div className="flex gap-1.5 flex-wrap w-[140px]">
                                        {COLOR_SWATCHES.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setNewColor(c)}
                                                className="w-6 h-6 rounded-full border-2 transition-all"
                                                style={{ backgroundColor: c, borderColor: newColor === c ? '#000' : 'transparent' }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), color: newColor })}
                                    disabled={!newName.trim() || createMutation.isPending}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Create
                                </button>
                                <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-[14px] hover:bg-muted/80 flex items-center gap-2">
                                    <X className="w-3.5 h-3.5" /> Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lists */}
                    {isLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : lists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Users className="w-10 h-10 text-muted-foreground/40" />
                            <p className="text-[15px] text-muted-foreground">No lists yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {lists.map((list: any) => {
                                const isExpanded = expandedListId === list._id
                                const isEditing = editingListId === list._id
                                const isConfirmDelete = confirmDeleteId === list._id

                                return (
                                    <div key={list._id} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                                        {/* List Row */}
                                        <div
                                            className={`flex items-center gap-3 px-4 py-3.5${!isEditing && !isConfirmDelete ? ' cursor-pointer select-none' : ''}`}
                                            onClick={!isEditing && !isConfirmDelete ? () => setExpandedListId(isExpanded ? null : list._id) : undefined}
                                        >
                                            {/* Color dot / edit swatch */}
                                            {isEditing ? (
                                                <div className="flex gap-1 flex-wrap w-[100px]" onClick={e => e.stopPropagation()}>
                                                    {COLOR_SWATCHES.map(c => (
                                                        <button
                                                            key={c}
                                                            onClick={() => setEditColor(c)}
                                                            className="w-5 h-5 rounded-full border-2 transition-all"
                                                            style={{ backgroundColor: c, borderColor: editColor === c ? '#000' : 'transparent' }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: list.color || '#3B82F6' }} />
                                            )}

                                            {/* Name */}
                                            {isEditing ? (
                                                <input
                                                    autoFocus
                                                    className="flex-1 border border-border rounded-md px-2 py-1 text-[14px] bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && editName.trim()) updateMutation.mutate({ id: list._id, name: editName.trim(), color: editColor })
                                                        if (e.key === 'Escape') setEditingListId(null)
                                                    }}
                                                />
                                            ) : (
                                                <span className="flex-1 text-[15px] font-semibold text-foreground">{list.name}</span>
                                            )}

                                            {/* Candidate count */}
                                            <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                {list.candidates?.length ?? 0} candidate{(list.candidates?.length ?? 0) !== 1 ? 's' : ''}
                                            </span>

                                            {/* Actions */}
                                            {isEditing ? (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => editName.trim() && updateMutation.mutate({ id: list._id, name: editName.trim(), color: editColor })}
                                                        disabled={!editName.trim() || updateMutation.isPending}
                                                        className="p-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                                                        title="Save"
                                                    >
                                                        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button onClick={() => setEditingListId(null)} className="p-1.5 rounded bg-muted hover:bg-muted/80" title="Cancel">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : isConfirmDelete ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] text-destructive font-medium">Delete "{list.name}"?</span>
                                                    <button
                                                        onClick={() => deleteMutation.mutate(list._id)}
                                                        disabled={deleteMutation.isPending}
                                                        className="px-2.5 py-1 bg-destructive text-destructive-foreground text-[12px] font-semibold rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                        Yes, delete
                                                    </button>
                                                    <button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1 bg-muted text-muted-foreground text-[12px] rounded hover:bg-muted/80">Cancel</button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation()
                                                            setEditingListId(list._id)
                                                            setEditName(list.name)
                                                            setEditColor(list.color || '#3B82F6')
                                                        }}
                                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Rename / recolor"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(list._id) }}
                                                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                        title="Delete list"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setExpandedListId(isExpanded ? null : list._id) }}
                                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                                                        title={isExpanded ? 'Collapse' : 'View candidates'}
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Expanded Candidates */}
                                        {isExpanded && (
                                            <div className="border-t border-border bg-muted/20">
                                                {isLoadingExpanded ? (
                                                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                                                ) : !expandedList?.candidates?.length ? (
                                                    <div className="py-8 text-center text-[13px] text-muted-foreground">No candidates in this list yet.</div>
                                                ) : (
                                                    <div className="divide-y divide-border">
                                                        {(expandedList.candidates as any[])
                                                            .filter((c, i, arr) => arr.findIndex((x: any) => x._id === c._id) === i)
                                                            .map((c: any) => (
                                                            <div key={c._id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                                                                {/* Avatar */}
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                                                    <span className="text-[13px] font-bold text-primary uppercase">{c.name?.charAt(0) || '?'}</span>
                                                                </div>
                                                                {/* Info */}
                                                                <div className="flex-1 min-w-0">
                                                                    <Link href={`/candidates/${c._id}`} className="text-[14px] font-semibold text-foreground hover:text-primary transition-colors truncate block">
                                                                        {c.name}
                                                                    </Link>
                                                                    <p className="text-[12px] text-muted-foreground truncate">
                                                                        {[c.designation, c.currentCompany].filter(Boolean).join(' · ')}
                                                                        {c.experience ? ` · ${c.experience} yrs` : ''}
                                                                        {c.location ? ` · ${c.location}` : ''}
                                                                    </p>
                                                                </div>
                                                                {/* Skills */}
                                                                {c.skills?.length > 0 && (
                                                                    <div className="hidden md:flex gap-1 flex-wrap max-w-[200px]">
                                                                        {c.skills.slice(0, 3).map((s: string, i: number) => (
                                                                            <span key={i} className="text-[11px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 px-1.5 py-0.5 rounded">{s}</span>
                                                                        ))}
                                                                        {c.skills.length > 3 && <span className="text-[11px] text-muted-foreground">+{c.skills.length - 3}</span>}
                                                                    </div>
                                                                )}
                                                                {/* Remove */}
                                                                <button
                                                                    onClick={() => removeCandidateMutation.mutate({ listId: list._id, candidateId: c._id })}
                                                                    disabled={removeCandidateMutation.isPending}
                                                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                                    title="Remove from list"
                                                                >
                                                                    <UserMinus className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    )
}
