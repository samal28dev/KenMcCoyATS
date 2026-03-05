import { NextResponse } from 'next/server'
import dbConnect from '../../../lib/db'
import Client from '../../../models/Client'
import Position from '../../../models/Position'
import Candidate from '../../../models/Candidate'
import CandidatePosition from '../../../models/CandidatePosition'
import ActivityFeed from '../../../models/ActivityFeed'
import { verifyAuth } from '../../../lib/auth'

// GET /api/analytics — dashboard stats
export async function GET(req: Request) {
    try {
        const user = await verifyAuth()
        if (!user) {
            const res = NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
            res.cookies.delete('ats_token')
            return res
        }

        await dbConnect()

        const [
            totalClients,
            activeClients,
            totalPositions,
            openPositions,
            totalCandidates,
            candidatesByStatus,
            recentActivity,
            expiringAgreements
        ] = await Promise.all([
            Client.countDocuments(),
            Client.countDocuments({ status: 'active' }),
            Position.countDocuments(),
            Position.countDocuments({ status: { $ne: 'closed' } }),
            Candidate.countDocuments(),
            Candidate.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            ActivityFeed.find({}).sort({ timestamp: -1 }).limit(10).lean(),
            // Client agreements expiring within 30 days
            Client.find({
                agreementValidTill: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                status: 'active'
            }).select('companyName agreementValidTill').lean()
        ])

        // Pipeline stats
        const pipelineStats: Record<string, number> = {}
        for (const s of candidatesByStatus) {
            pipelineStats[s._id] = s.count
        }

        return NextResponse.json({
            totalClients,
            activeClients,
            totalPositions,
            openPositions,
            totalCandidates,
            pipelineStats,
            recentActivity,
            expiringAgreements,
        })
    } catch (error) {
        console.error('Analytics error:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}
