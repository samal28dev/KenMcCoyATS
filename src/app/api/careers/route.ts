import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Position from '@/models/Position'
import Client from '@/models/Client'

/**
 * GET /api/careers — public endpoint (no auth required)
 * Returns open positions for the public careers page.
 */
export async function GET(request: Request) {
    try {
        await dbConnect()

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const location = searchParams.get('location')

        const filter: any = {
            status: { $in: ['new', 'work-in-progress'] }, // Only show open positions
        }

        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            filter.$or = [
                { title: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
            ]
        }

        const positions = await Position.find(filter)
            .populate('clientId', 'companyName address.city address.state locationType')
            .select('title description requirements status createdAt clientId')
            .sort({ createdAt: -1 })
            .lean()

        // Filter by location (city) if provided — post-populate filter
        let results = positions as any[]
        if (location && location !== 'all') {
            results = results.filter(
                (p: any) => p.clientId?.address?.city?.toLowerCase().includes(location.toLowerCase())
            )
        }

        // Map to public-safe shape (no internal IDs exposed beyond position ID)
        const publicPositions = results.map((p: any) => ({
            id: p._id.toString(),
            title: p.title,
            description: p.description || '',
            requirements: p.requirements || [],
            company: p.clientId?.companyName || 'Ken McCoy Consulting',
            location: p.clientId?.address
                ? `${p.clientId.address.city || ''}${p.clientId.address.state ? ', ' + p.clientId.address.state : ''}`
                : 'India',
            locationType: p.clientId?.locationType || 'office',
            status: p.status,
            postedAt: p.createdAt,
        }))

        return NextResponse.json({ positions: publicPositions, total: publicPositions.length })
    } catch (error) {
        console.error('Public careers API error:', error)
        return NextResponse.json({ error: 'Failed to load positions' }, { status: 500 })
    }
}
