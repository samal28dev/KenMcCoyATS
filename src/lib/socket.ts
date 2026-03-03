import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import type { NextApiRequest } from 'next'
import type { NextApiResponse } from 'next'

/**
 * Global Socket.io server instance.
 * Attached to the HTTP server on first init.
 */
let io: SocketIOServer | null = null

export function getIO(): SocketIOServer | null {
    return io
}

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
    if (io) return io

    io = new SocketIOServer(httpServer, {
        path: '/api/socketio',
        addTrailingSlash: false,
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    })

    io.on('connection', (socket) => {

        // Join user-specific room for targeted notifications
        socket.on('join', (userId: string) => {
            if (userId) {
                socket.join(`user:${userId}`)
            }
        })

        // Join role-based room
        socket.on('joinRole', (role: string) => {
            if (role) {
                socket.join(`role:${role}`)
            }
        })

        socket.on('disconnect', () => {
        })
    })

    return io
}

// ── Event types ──
export type RealtimeEvent =
    | 'candidate:created'
    | 'candidate:updated'
    | 'candidate:assigned'
    | 'position:created'
    | 'position:updated'
    | 'pipeline:updated'
    | 'client:created'
    | 'client:updated'
    | 'notification:new'
    | 'task:created'
    | 'task:updated'
    | 'email:sent'
    | 'comment:created'
    | 'interview:created'
    | 'interview:updated'
    | 'billing:updated'
    | 'import:completed'
    | 'dashboard:refresh'

/**
 * Emit a real-time event to all connected clients.
 * Call this from any API route after a mutation.
 */
export function emitRealtimeEvent(
    event: RealtimeEvent,
    data: Record<string, any> = {},
    options?: {
        toUserId?: string       // Send only to a specific user
        toRole?: string         // Send only to a specific role
    }
) {
    const socketServer = getIO()
    if (!socketServer) return  // Socket not initialized, skip silently

    const payload = { event, data, timestamp: Date.now() }

    if (options?.toUserId) {
        socketServer.to(`user:${options.toUserId}`).emit(event, payload)
    } else if (options?.toRole) {
        socketServer.to(`role:${options.toRole}`).emit(event, payload)
    } else {
        socketServer.emit(event, payload)
    }
}
