import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/db';
import CandidateList from '../../../models/CandidateList';
import { verifyAuth } from '../../../lib/auth';

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();

        // Fetch lists created by this user
        const lists = await CandidateList.find({ createdBy: user.id }).sort({ createdAt: -1 });
        return NextResponse.json(lists);
    } catch (error: any) {
        console.error('Error fetching candidate lists:', error);
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await verifyAuth();
        if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        await dbConnect();

        const body = await req.json();
        const { name, color } = body;

        if (!name) {
            return NextResponse.json({ message: 'List name is required' }, { status: 400 });
        }

        const newList = await CandidateList.create({
            name,
            color: color || '#3B82F6',
            createdBy: user.id,
            candidates: []
        });

        return NextResponse.json(newList, { status: 201 });
    } catch (error: any) {
        console.error('Error creating candidate list:', error);
        if (error.code === 11000) {
            return NextResponse.json({ message: 'A list with this name already exists' }, { status: 409 });
        }
        return NextResponse.json({ message: error.message || 'Server error' }, { status: 500 });
    }
}
