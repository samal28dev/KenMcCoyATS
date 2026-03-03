'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

let globalSocket: Socket | null = null

/**
 * Get or create a shared Socket.io client instance.
 */
function getSocket(): Socket {
    if (!globalSocket) {
        globalSocket = io({
            path: '/api/socketio',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        })
    }
    return globalSocket
}

/**
 * Hook that connects to the Socket.io server, joins user/role rooms,
 * and auto-invalidates React Query caches when real-time events arrive.
 *
 * Usage: call once in your app shell / layout wrapper.
 */
export function useRealtimeSync() {
    const queryClient = useQueryClient()
    const socketRef = useRef<Socket | null>(null)

    // Map of events → query keys to invalidate
    const eventQueryMap: Record<string, string[]> = {
        'candidate:created': ['candidates', 'analytics'],
        'candidate:updated': ['candidates', 'analytics'],
        'candidate:assigned': ['candidates', 'candidate-positions', 'analytics'],
        'position:created': ['positions', 'analytics'],
        'position:updated': ['positions', 'analytics'],
        'pipeline:updated': ['candidate-positions', 'candidates', 'analytics'],
        'client:created': ['clients', 'analytics'],
        'client:updated': ['clients', 'analytics'],
        'notification:new': ['notifications'],
        'task:created': ['tasks', 'analytics'],
        'task:updated': ['tasks'],
        'email:sent': ['emails'],
        'comment:created': ['comments', 'candidates', 'positions', 'clients'],
        'interview:created': ['interviews', 'candidates', 'analytics'],
        'interview:updated': ['interviews', 'candidates'],
        'billing:updated': ['billing', 'analytics'],
        'import:completed': ['candidates', 'clients', 'positions', 'analytics'],
        'dashboard:refresh': ['analytics'],
    }

    useEffect(() => {
        const socket = getSocket()
        socketRef.current = socket

        // Join user-specific room
        const userId = typeof window !== 'undefined' ? localStorage.getItem('ats_user_id') : null
        const userRole = typeof window !== 'undefined' ? localStorage.getItem('ats_user_role') : null

        if (userId) socket.emit('join', userId)
        if (userRole) socket.emit('joinRole', userRole)

        // Listen for all real-time events
        for (const [event, queryKeys] of Object.entries(eventQueryMap)) {
            socket.on(event, (payload: any) => {
                // Invalidate relevant query caches so data refreshes
                for (const key of queryKeys) {
                    queryClient.invalidateQueries({ queryKey: [key] })
                }

                // Show toast for important events (only if from another user)
                const currentUserId = localStorage.getItem('ats_user_id')
                if (payload?.data?.actorId && payload.data.actorId !== currentUserId) {
                    if (event === 'candidate:assigned') {
                        toast.info(`${payload.data.actorName || 'Someone'} assigned a candidate`)
                    } else if (event === 'pipeline:updated') {
                        toast.info(`Pipeline updated: ${payload.data.candidateName || 'a candidate'}`)
                    } else if (event === 'notification:new' && payload.data.message) {
                        toast.info(payload.data.message)
                    }
                }
            })
        }

        // Connection status
        socket.on('connect', () => {
            // connected
        })

        socket.on('disconnect', (_reason: string) => {
            // disconnected
        })

        socket.on('connect_error', (err: Error) => {
            console.warn('[Socket.io] Connection error:', err.message)
        })

        return () => {
            // Clean up listeners (but keep the socket alive for reconnects)
            for (const event of Object.keys(eventQueryMap)) {
                socket.off(event)
            }
            socket.off('connect')
            socket.off('disconnect')
            socket.off('connect_error')
        }
    }, [queryClient])

    return socketRef
}

/**
 * Standalone hook to check socket connection status.
 */
export function useSocketStatus() {
    const socketRef = useRef<Socket | null>(null)

    useEffect(() => {
        socketRef.current = getSocket()
    }, [])

    return {
        isConnected: socketRef.current?.connected ?? false,
        socketId: socketRef.current?.id ?? null,
    }
}
