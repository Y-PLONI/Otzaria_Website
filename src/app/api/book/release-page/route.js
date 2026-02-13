import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Page from '@/models/Page';
import Book from '@/models/Book';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { pageId } = await request.json();
    await connectDB();

    const pageBefore = await Page.findOne({ _id: pageId, claimedBy: session.user._id });
    
    if (!pageBefore) {
        return NextResponse.json({ error: 'העמוד לא נמצא או שאינו משויך אליך' }, { status: 404 });
    }

    const parentBook = await Book.findById(pageBefore.book);
    
    if (parentBook && (parentBook.isPrivate || parentBook.ownerId)) {
        return NextResponse.json({ 
            success: false, 
            error: 'לא ניתן לשחרר עמודים בספר אישי' 
        }, { status: 400 });
    }

    const wasCompleted = pageBefore.status === 'completed';

    await Page.findByIdAndUpdate(pageId, {
        status: 'available',
        $unset: { claimedBy: "", claimedAt: "", completedAt: "" }
    });

    if (wasCompleted) {
        await Book.findByIdAndUpdate(pageBefore.book, { $inc: { completedPages: -1 } });
    }

    return NextResponse.json({ 
        success: true,
        message: 'העמוד שוחרר בהצלחה'
    });

  } catch (error) {
    console.error('Release Page Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}