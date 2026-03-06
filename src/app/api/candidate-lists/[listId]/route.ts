import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CandidateList from '@/models/CandidateList';
import { verifyAuth } from '@/lib/auth';

// GET /api/candidate-lists/[listId] — single list with populated candidates
export async function GET(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        const { listId } = await params;

        const list = await CandidateList.findOne({ _id: listId, createdBy: user.id })
            .populate('candidates', 'name designation currentCompany experience location phone email skills resumeFile resumeFilename')
            .lean();

        if (!list) return NextResponse.json({ message: 'List not found' }, { status: 404 });

        return NextResponse.json(list);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}

// PATCH /api/candidate-lists/[listId] — rename / recolor
export async function PATCH(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        const { listId } = await params;
        const body = await req.json();
        const { name, color } = body;

        const list = await CandidateList.findOne({ _id: listId, createdBy: user.id });
        if (!list) return NextResponse.json({ message: 'List not found' }, { status: 404 });

        if (name !== undefined) list.name = name;
        if (color !== undefined) list.color = color;
        await list.save();

        return NextResponse.json(list);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}

// DELETE /api/candidate-lists/[listId] — delete entire list
export async function DELETE(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();
        const { listId } = await params;

        const list = await CandidateList.findOneAndDelete({ _id: listId, createdBy: user.id });
        if (!list) return NextResponse.json({ message: 'List not found' }, { status: 404 });

        return NextResponse.json({ message: 'List deleted' });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}
