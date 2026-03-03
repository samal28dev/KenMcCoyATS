'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/providers/auth-provider'
import { MessageSquare, Send, Pencil, Trash2, CornerDownRight } from 'lucide-react'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface CommentsWidgetProps {
    entityType: 'candidate' | 'position' | 'client' | 'task'
    entityId: string
}

export function CommentsWidget({ entityType, entityId }: CommentsWidgetProps) {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [newComment, setNewComment] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    const { data: comments = [], isLoading } = useQuery({
        queryKey: ['comments', entityType, entityId],
        queryFn: async () => {
            const res = await apiFetch(`/api/comments?entityType=${entityType}&entityId=${entityId}`)
            return res.json()
        },
        enabled: !!entityId,
    })

    const createMutation = useMutation({
        mutationFn: async (content: string) => {
            const res = await apiFetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entityType, entityId, content }),
            })
            if (!res.ok) throw new Error('Failed to post comment')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
            setNewComment('')
        },
    })

    const editMutation = useMutation({
        mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
            const res = await apiFetch('/api/comments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId, content }),
            })
            if (!res.ok) throw new Error('Failed to edit comment')
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] })
            setEditingId(null)
            setEditContent('')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async (commentId: string) => {
            const res = await apiFetch(`/api/comments?id=${commentId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete comment')
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', entityType, entityId] }),
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim()) return
        createMutation.mutate(newComment.trim())
    }

    const handleEdit = (commentId: string) => {
        if (!editContent.trim()) return
        editMutation.mutate({ commentId, content: editContent.trim() })
    }

    return (
        <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Comments</h2>
                <span className="text-xs text-muted-foreground">({comments.length})</span>
            </div>

            {/* New comment form */}
            <form onSubmit={handleSubmit} className="flex gap-2 mb-5">
                <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                    type="submit"
                    disabled={!newComment.trim() || createMutation.isPending}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    <Send className="h-4 w-4" />
                </button>
            </form>

            {/* Comments list */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2].map((i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-3 w-24 bg-muted rounded mb-1.5" />
                            <div className="h-3 w-full bg-muted/60 rounded" />
                        </div>
                    ))}
                </div>
            ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
            ) : (
                <div className="space-y-4">
                    {comments.map((comment: any) => (
                        <div key={comment._id} className="group">
                            {comment.parentId && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-2">
                                    <CornerDownRight className="h-3 w-3" />
                                    <span>Reply to {comment.parentId?.authorId?.name || 'unknown'}</span>
                                </div>
                            )}
                            <div className="rounded-lg bg-muted/30 p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-[10px] font-semibold text-primary">
                                                {(comment.authorId?.name || '?')[0].toUpperCase()}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium">{comment.authorId?.name || 'Unknown'}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {comment.authorId?.role?.replace('_', ' ')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            · {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                        </span>
                                        {comment.isEdited && (
                                            <span className="text-[10px] text-muted-foreground italic">(edited)</span>
                                        )}
                                    </div>
                                    {/* Actions — only for own comments */}
                                    {user && comment.authorId?._id === user._id && (
                                        <div className="hidden group-hover:flex items-center gap-1">
                                            <button
                                                onClick={() => { setEditingId(comment._id); setEditContent(comment.content) }}
                                                className="p-1 rounded hover:bg-muted transition-colors"
                                            >
                                                <Pencil className="h-3 w-3 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm('Delete this comment?')) deleteMutation.mutate(comment._id) }}
                                                className="p-1 rounded hover:bg-muted transition-colors"
                                            >
                                                <Trash2 className="h-3 w-3 text-muted-foreground" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editingId === comment._id ? (
                                    <div className="flex gap-2 mt-1">
                                        <input
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
                                            autoFocus
                                        />
                                        <button onClick={() => handleEdit(comment._id)}
                                            className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded font-medium">Save</button>
                                        <button onClick={() => setEditingId(null)}
                                            className="px-2 py-1 text-xs border border-border rounded hover:bg-muted">Cancel</button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
