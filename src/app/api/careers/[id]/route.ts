import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Position from '@/models/Position'

/**
 * GET /api/careers/[id] — public endpoint (no auth required)
 * Returns a single position's details for the public careers detail page.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
    try {
        await dbConnect()

        const position = await Position.findById(params.id)
            .populate('clientId', 'companyName address.city address.state locationType')
            .select('title description requirements status createdAt clientId')
            .lean() as any

        if (!position) {
            return NextResponse.json({ error: 'Position not found' }, { status: 404 })
        }

        // Only show open positions publicly
        if (position.status === 'closed') {
            return NextResponse.json({ error: 'This position is no longer open' }, { status: 410 })
        }

        return NextResponse.json({
            id: position._id.toString(),
            title: position.title,
            description: position.description || '',
            requirements: position.requirements || [],
            company: position.clientId?.companyName || 'Ken McCoy Consulting',
            location: position.clientId?.address
                ? `${position.clientId.address.city || ''}${position.clientId.address.state ? ', ' + position.clientId.address.state : ''}`
                : 'India',
            locationType: position.clientId?.locationType || 'office',
            status: position.status,
            postedAt: position.createdAt,
        })
    } catch (error) {
        console.error('Public career detail error:', error)
        return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    }
}
