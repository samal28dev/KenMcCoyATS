import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import CandidateList from '@/models/CandidateList';
import { verifyAuth } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();

        const body = await req.json();
        const { candidateId } = body;
        const { listId } = await params;

        if (!candidateId) {
            return NextResponse.json({ message: 'Candidate ID is required' }, { status: 400 });
        }

        // Check if list exists and belongs to user
        const list = await CandidateList.findOne({ _id: listId, createdBy: user.id });

        if (!list) {
            return NextResponse.json({ message: 'List not found' }, { status: 404 });
        }

        // Add candidate to list if not already present
        if (!list.candidates.includes(candidateId)) {
            list.candidates.push(candidateId);
            await list.save();
            return NextResponse.json({ message: 'Candidate added to list successfully', list });
        } else {
            return NextResponse.json({ message: 'Candidate is already in this list', list }, { status: 200 });
        }

    } catch (error: any) {
        console.error('Error adding candidate to list:', error);
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}

// DELETE /api/candidate-lists/[listId]/candidates — remove a candidate from the list
export async function DELETE(req: Request, { params }: { params: Promise<{ listId: string }> }) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();

        const { listId } = await params;
        const body = await req.json();
        const { candidateId } = body;

        if (!candidateId) {
            return NextResponse.json({ message: 'Candidate ID is required' }, { status: 400 });
        }

        const list = await CandidateList.findOne({ _id: listId, createdBy: user.id });
        if (!list) return NextResponse.json({ message: 'List not found' }, { status: 404 });

        list.candidates = list.candidates.filter(
            (id: any) => id.toString() !== candidateId
        );
        await list.save();

        return NextResponse.json({ message: 'Candidate removed from list', list });
    } catch (error: any) {
        console.error('Error removing candidate from list:', error);
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}
