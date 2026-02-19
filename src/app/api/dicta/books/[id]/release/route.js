import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import dbConnect from '@/lib/db' 
import DictaBook from '@/models/DictaBook'
import { authOptions } from '@/app/api/auth/[...nextauth]/route' 

export async function POST(request, context) {
  console.log('--- START RELEASE API ---');

  try {
    // פותרים את ה-Promise של ה-params
    const params = await context.params;
    const bookId = params.id;
    console.log('1. Book ID from params:', bookId);

    // 1. אימות המשתמש
    console.log('2. Fetching session...');
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log('❌ Auth Failed: No session or user.id is missing');
      return NextResponse.json({ error: 'אינך מורשה לבצע פעולה זו - חסר זיהוי משתמש' }, { status: 401 });
    }

    const userId = String(session.user.id); // ממירים למחרוזת ליתר ביטחון
    const userName = session.user.name || 'משתמש לא ידוע';
    const isAdmin = session.user.role === 'admin';
    
    console.log(`✅ User identified: ID=${userId}, Role=${session.user.role}`);

    // 2. חיבור למסד הנתונים
    console.log('3. Connecting to DB...');
    await dbConnect();
    
    // 3. שליפת הספר
    console.log(`4. Looking for book with ID: ${bookId}`);
    const book = await DictaBook.findById(bookId);
    
    if (!book) {
      console.log('❌ Book not found in DB.');
      return NextResponse.json({ error: 'הספר לא נמצא' }, { status: 404 });
    }

    console.log('✅ Book found:', book.title);
    
    // דיבוג מעמיק של זהות המשתמש מול זהות התופס
    console.log('Current claimedBy in DB (raw):', book.claimedBy);
    
    const claimedByIdString = book.claimedBy ? book.claimedBy.toString() : null;
    console.log('ClaimedBy (Stringified):', claimedByIdString);
    console.log('Current User ID trying to release:', userId);

    // 4. בדיקת הרשאות
    const isOwner = claimedByIdString === userId;
    console.log(`Is Owner? ${isOwner} | Is Admin? ${isAdmin}`);
    
    if (!isOwner && !isAdmin) {
      console.log('❌ ERROR: User is not the owner and not an admin.');
      // מחזירים את נתוני הדיבוג ללקוח כדי שנוכל לראות אותם בלשונית ה-Network
      return NextResponse.json({ 
        error: 'אינך מורשה לשחרר ספר זה',
        debug: { userId, claimedByIdString, isAdmin }
      }, { status: 403 });
    }

    // 5. איפוס נתוני התפיסה בספר
    console.log('5. Releasing book fields...');
    book.claimedBy = null;
    book.claimedAt = null;
    book.status = 'available';

    // 6. הוספת הפעולה להיסטוריה
    book.history.push({
      description: 'הספר שוחרר והוחזר למאגר העריכה',
      editorId: userId,
      editorName: userName,
      timestamp: new Date()
    });

    // 7. שמירה במסד הנתונים
    console.log('6. Saving book...');
    await book.save();
    console.log('✅ Book released successfully!');

    return NextResponse.json({ success: true, message: 'הספר שוחרר בהצלחה' }, { status: 200 });

  } catch (error) {
    console.error('!!! ❌ ERROR IN RELEASE API ❌ !!!');
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
    
    return NextResponse.json({ 
      error: 'שגיאת שרת פנימית', 
      details: error.message 
    }, { status: 500 });
  }
}