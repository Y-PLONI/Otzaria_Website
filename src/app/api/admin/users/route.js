import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
    try {
        await connectDB();
        // מחזיר את המשתמשים ממוין לפי תאריך יצירה יורד
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        return NextResponse.json({ success: true, users });
    } catch (e) {
        return NextResponse.json({ success: false, error: e.message });
    }
}

export async function PUT(request) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { userId, role, points, name } = await request.json();
        await connectDB();
        
        // שימוש ב-{ new: true } כדי להחזיר את האובייקט המעודכן
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { role, points, name },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { userId } = await request.json();
        await connectDB();
        
        await User.findByIdAndDelete(userId);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}