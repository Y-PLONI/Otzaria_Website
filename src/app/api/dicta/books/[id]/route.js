import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DictaBook from '@/models/DictaBook';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user._id || session.user.id;
    const isAdmin = session.user.role === 'admin';

    await connectDB();
    const { id } = await params;
    const book = await DictaBook.findById(id).populate('claimedBy', 'name');
    
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check access: available books are accessible by all, in-progress only by owner or admin
    if (book.status === 'in-progress') {
      const isOwner = book.claimedBy?._id?.toString() === userId;
      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: 'Forbidden: This book is being edited by another user' }, { status: 403 });
      }
    }

    // Return book data directly from MongoDB (no temp file needed)
    return NextResponse.json(book.toObject());
  } catch (error) {
    console.error('Failed to fetch book:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user._id || session.user.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: User ID missing' }, { status: 401 });
    }
    const isAdmin = session.user.role === 'admin';

    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const { content, action, status } = body;

    const book = await DictaBook.findById(id);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // פעולת תפיסה (Claim) - תמיד מותר אם הספר פנוי
    if (action === 'claim') {
      if (book.status !== 'available') {
        return NextResponse.json({ error: 'Book already claimed' }, { status: 400 });
      }
      book.status = 'in-progress';
      book.claimedBy = userId;
      book.claimedAt = new Date();
      await book.save();
      return NextResponse.json({ success: true, message: 'Book claimed' });
    }

    // עדכון סטטוס ישיר (אדמין בלבד)
    if (status !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
      book.status = status;
      if (status === 'available') {
        book.claimedBy = null;
        book.claimedAt = null;
      } else if (status === 'completed') {
        book.completedAt = new Date();
      }
      await book.save();
      return NextResponse.json({ success: true, book });
    }

    // בדיקת הרשאה לפעולות עריכה/ניהול
    const isOwner = book.claimedBy?.toString() === userId;

    // חסימת שמירה אם המשתמש אינו אדמין ואינו התופס
    if (content !== undefined) {
      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: 'כדי לערוך יש לתפוס את הספר לעריכה' }, { status: 403 });
      }
      book.content = content;
    }

    // בדיקת הרשאה לשחרור, סיום או ביטול סיום
    if (action === 'release' || action === 'complete' || action === 'uncomplete') {
      if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      if (action === 'release') {
        book.status = 'available';
        book.claimedBy = null;
        book.claimedAt = null;
      } else if (action === 'complete') {
        book.status = 'completed';
        book.completedAt = new Date();
      } else if (action === 'uncomplete') {
        book.status = 'in-progress';
        book.completedAt = undefined;
      }
    }
    
    await book.save();
    return NextResponse.json(book);
  } catch (error) {
    console.error('Failed to update book:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    await DictaBook.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete book:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
