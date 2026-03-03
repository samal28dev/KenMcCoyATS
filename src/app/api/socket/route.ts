import { type NextRequest, NextResponse } from 'next/server'
import { initSocketIO, getIO } from '@/lib/socket'

/**
 * Socket.io initialization endpoint.
 * The actual WebSocket upgrade happens via the custom server.
 * This route just reports status.
 */
export async function GET() {
    const io = getIO()
    return NextResponse.json({
        socketEnabled: !!io,
        message: io
            ? `Socket.io running — ${io.engine.clientsCount} client(s) connected`
            : 'Socket.io not initialized. Use the custom server to enable WebSockets.',
    })
}
