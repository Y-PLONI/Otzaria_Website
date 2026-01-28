import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Message from '@/models/Message';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import mongoose from 'mongoose';
export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        await connectDB();
        
        const { searchParams } = new URL(request.url);
        const showAll = searchParams.get('allMessages'); 

        let query = {};
        
        
        if (session.user.role === 'admin' && showAll === 'true') {
             query = {}; 
        } else {
            query = { 
                $or: [
                    { sender: session.user._id },
                    { recipient: session.user._id }
                ]
            };
        }

        const messages = await Message.find(query)
            .populate('sender', 'name email role')
            .populate('replies.sender', 'name email role')
            .sort({ createdAt: -1 });

        const formattedMessages = messages.map(msg => ({
            id: msg._id,
            subject: msg.subject,
            content: msg.content,
            sender: msg.sender,
            isRead: msg.isRead,
            senderName: msg.sender?.name || 'משתמש לא ידוע',
            senderEmail: msg.sender?.email,
            status: msg.replies?.length > 0 ? 'replied' : (msg.isRead ? 'read' : 'unread'),
            createdAt: msg.createdAt,
            replies: (msg.replies || []).map(r => ({
                id: r._id,
                sender: r.sender?._id || r.sender,
                senderName: r.sender?.name,
                senderEmail: r.sender?.email,
                senderRole: r.sender?.role,
                content: r.content,
                createdAt: r.createdAt
            }))
        }));

        return NextResponse.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { subject, content, recipientId } = await request.json();
        await connectDB();

        await Message.create({
            sender: session.user._id,
            recipient: recipientId || null,
            subject,
            content,
            isRead: false
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function PUT(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { messageIds } = await request.json();
        
        console.log('--- DEBUG: PUT /api/messages ---');
        console.log('1. Raw IDs received:', messageIds);

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            console.log('2. No IDs to update');
            return NextResponse.json({ success: true }); 
        }

        await connectDB();

        const objectIds = messageIds.map(id => new mongoose.Types.ObjectId(id));

        const result = await Message.updateMany(
            { _id: { $in: objectIds } },
            { $set: { isRead: true } }
        );

        return NextResponse.json({ 
            success: true, 
            debug: { matched: result.matchedCount, modified: result.modifiedCount } 
        });

    } catch (error) {
        console.error('Error updating messages:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}