import { type NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { canPerformAction } from '@/lib/role-scope'
import dbConnect from '@/lib/db'
import Billing from '@/models/Billing'
import { emitRealtimeEvent } from '@/lib/socket'

// GET /api/billing — list billing records with filters
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only ops_head / super_admin can view billing
        if (!['super_admin', 'operations_head', 'admin', 'superadmin'].includes(user.role)) {
            return NextResponse.json({ error: 'Billing restricted to Operations Head and Admin' }, { status: 403 })
        }

        await dbConnect()
        const { searchParams } = new URL(request.url)
        const clientId = searchParams.get('clientId')
        const status = searchParams.get('status')
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        const filter: any = {}
        if (clientId) filter.clientId = clientId
        if (status) filter.status = status
        if (from || to) {
            filter.invoiceDate = {}
            if (from) filter.invoiceDate.$gte = new Date(from)
            if (to) filter.invoiceDate.$lte = new Date(to)
        }

        const records = await Billing.find(filter)
            .populate('clientId', 'companyName')
            .populate('positionId', 'title')
            .populate('candidateId', 'name')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .lean()

        const totalAmount = records.reduce((sum: number, r: any) => sum + (r.amount || 0), 0)

        return NextResponse.json({ records, totalAmount })
    } catch (error) {
        console.error('Billing list error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST /api/billing — create a billing record
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!['super_admin', 'operations_head', 'admin', 'superadmin'].includes(user.role)) {
            return NextResponse.json({ error: 'Billing restricted to Operations Head and Admin' }, { status: 403 })
        }

        await dbConnect()
        const body = await request.json()

        if (!body.clientId || body.amount == null) {
            return NextResponse.json({ error: 'clientId and amount are required' }, { status: 400 })
        }

        const record = await Billing.create({ ...body, createdBy: user._id })

        emitRealtimeEvent('billing:updated', {
            billingId: record._id.toString(),
            action: 'created',
            actorId: user._id.toString(),
        })
        emitRealtimeEvent('dashboard:refresh', { reason: 'billing_created' })

        return NextResponse.json(record, { status: 201 })
    } catch (error) {
        console.error('Billing create error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH /api/billing — update a billing record
export async function PATCH(request: NextRequest) {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        if (!['super_admin', 'operations_head', 'admin', 'superadmin'].includes(user.role)) {
            return NextResponse.json({ error: 'Billing restricted to Operations Head and Admin' }, { status: 403 })
        }

        await dbConnect()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

        const updated = await Billing.findByIdAndUpdate(id, updates, { new: true })
            .populate('clientId', 'companyName')
            .populate('positionId', 'title')
            .lean()

        if (!updated) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

        emitRealtimeEvent('billing:updated', {
            billingId: id,
            action: 'updated',
            actorId: user._id.toString(),
        })
        emitRealtimeEvent('dashboard:refresh', { reason: 'billing_updated' })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Billing update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
