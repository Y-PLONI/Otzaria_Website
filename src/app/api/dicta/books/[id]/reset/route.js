import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import DictaBook from '@/models/DictaBook';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const DEFAULT_REPO_URL = "https://raw.githubusercontent.com/Otzaria/otzaria-library/refs/heads/main";
const DEFAULT_FOLDER = "DictaToOtzaria/לא ערוך";

/**
 * איפוס ספר - משיכת נתונים מחדש מגיטהאב
 * רק תופס הספר או מנהל יכולים לבצע פעולה זו
 */
export async function POST(request, context) {
  const params = await context.params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'אינך מורשה לבצע פעולה זו' }, { status: 401 });
    }

    const bookId = params.id;
    const userId = session.user.id;
    const isAdmin = session.user.role === 'admin';

    await connectDB();
    const book = await DictaBook.findById(bookId);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // בדיקת הרשאות - רק תופס הספר או מנהל
    const isOwner = book.claimedBy?.toString() === userId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ 
        error: 'אין הרשאה: רק תופס הספר או מנהל יכולים לאפס את הספר' 
      }, { status: 403 });
    }

    const baseUrl = process.env.DICTA_GITHUB_REPO || DEFAULT_REPO_URL;

    // בניית שם הקובץ מתוך שם הספר
    // קודם ננסה למצוא את שם הקובץ המקורי מתוך list.txt
    const listUrl = `${baseUrl}/${DEFAULT_FOLDER}/list.txt`;
    const listResp = await fetch(listUrl);
    
    let fileName = null;
    
    if (listResp.ok) {
      const rawText = await listResp.text();
      const fileList = rawText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && line.endsWith('.txt'));
      
      // חיפוש הקובץ שמתאים לשם הספר
      fileName = fileList.find(file => {
        const titleFromFile = file
          .replace(/\.txt$/i, '')
          .replace(/_/g, ' ')
          .trim();
        return titleFromFile === book.title;
      });
    }
    
    // אם לא מצאנו בlist.txt, ננסה לבנות את שם הקובץ
    if (!fileName) {
      fileName = `${book.title.replace(/\s+/g, '_')}.txt`;
    }
    
    const contentUrl = `${baseUrl}/${DEFAULT_FOLDER}/ספרים/אוצריא/${encodeURIComponent(fileName)}`;

    // משיכת התוכן מגיטהאב
    const contentResp = await fetch(contentUrl);
    
    if (!contentResp.ok) {
      return NextResponse.json({ 
        error: `שגיאה בהורדת הספר מגיטהאב (סטטוס: ${contentResp.status})`,
        details: `לא ניתן למצוא את הקובץ: ${fileName}`
      }, { status: 404 });
    }

    const freshContent = await contentResp.text();

    // עדכון התוכן בספר
    book.content = freshContent;
    book.updatedAt = new Date();
    await book.save();

    return NextResponse.json({ 
      success: true, 
      message: 'הספר אופס בהצלחה ונתוניו נמשכו מחדש מגיטהאב',
      book: book.toObject()
    });

  } catch (error) {
    console.error('Failed to reset book:', error);
    return NextResponse.json({ 
      error: 'שגיאה פנימית בשרת', 
      details: error.message 
    }, { status: 500 });
  }
}
