import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Page from '@/models/Page';
import User from '@/models/User';
import Book from '@/models/Book'; 
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const userId = session.user.id || session.user._id;

    // 1. שליפת המשתמש
    const user = await User.findById(userId).select('points');
    
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. סטטיסטיקות
    const stats = await Page.aggregate([
      // שלב א': מביאים את הדפים של המשתמש
      { $match: { claimedBy: user._id } },
      
      // שלב ב': מביאים את פרטי הספר כדי לבדוק אם הוא מוסתר
      {
        $lookup: {
          from: 'books',        // שם הקולקציה בדאטהבייס (ברירת המחדל של Mongoose ל-Book)
          localField: 'book',   // השדה במודל Page
          foreignField: '_id',  // השדה במודל Book
          as: 'bookData'
        }
      },
      { $unwind: '$bookData' }, // הופכים את המערך לאובייקט (ומסננים דפים ללא ספר תקין)

      // שלב ג': הסינון המבוקש לסטטיסטיקות
      // "שלא יתחשבנו אם הם לא הושלמו וגם מוסתרים"
      // כלומר: משאירים את הדף אם: (הספר לא מוסתר) או (הדף הושלם)
      {
        $match: {
          $or: [
            { 'bookData.isHidden': { $ne: true } }, // תנאי 1: הספר גלוי
            { status: 'completed' }                 // תנאי 2: הדף הושלם (גם אם הספר מוסתר - הוא ייספר)
          ]
        }
      },

      // שלב ד': הקיבוץ והספירה (כמו שהיה קודם)
      {
        $group: {
          _id: null,
          totalMyPages: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] } }
        }
      }
    ]);

    const userStats = stats[0] || { totalMyPages: 0, completed: 0, inProgress: 0 };

    // 3. פעילות אחרונה (כולל הסינון הקודם: הסתרת ספרים מוסתרים לחלוטין מהפיד)
    const recentActivityRaw = await Page.find({ claimedBy: user._id })
      .sort({ status: -1, updatedAt: -1 }) 
      .limit(30) // שליפת "באפר"
      .populate({
        path: 'book',
        select: 'name slug isHidden',
        match: { isHidden: { $ne: true } } // סינון ברמת ה-Populate לפעילות אחרונה
      })
      .lean();

    // מיפוי הנתונים וסינון (פעילות אחרונה)
    const recentActivity = recentActivityRaw
      .filter(page => page.book) // מסננים דפים שהספר שלהם מוסתר (חזר כ-null בגלל ה-match)
      .slice(0, 10)
      .map(page => {
        return {
          id: page._id.toString(),
          bookName: page.book.name,
          bookPath: page.book.slug || '#',
          pageNumber: page.pageNumber,
          status: page.status,
          date: page.updatedAt ? new Date(page.updatedAt).toLocaleDateString('he-IL') : '-'
        };
      });

    return NextResponse.json({
      success: true,
      stats: {
        myPages: userStats.totalMyPages,
        completedPages: userStats.completed,
        inProgressPages: userStats.inProgress,
        points: user.points || 0,
        recentActivity
      }
    });

  } catch (error) {
    console.error('User Stats API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}