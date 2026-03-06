import { NextResponse } from 'next/server'
import dbConnect from '../../../../lib/db'
import Candidate from '../../../../models/Candidate'

export async function GET(req: Request) {
    try {
        await dbConnect()
        const count = await Candidate.countDocuments()
        const sample = await Candidate.findOne().select('name email workExperience education').lean()
        return NextResponse.json({
            ok: true,
            count,
            sample: sample ? {
                name: (sample as any).name,
                hasWorkExperience: Array.isArray((sample as any).workExperience),
                hasEducation: Array.isArray((sample as any).education),
            } : null
        })
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.slice(0, 500) }, { status: 500 })
    }
}
