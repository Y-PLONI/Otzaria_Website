import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Upload from '@/models/Upload';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// טיפול בהעלאת קובץ טקסט ע"י משתמש
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await request.formData();
        const file = formData.get('file');
        const bookName = formData.get('bookName');

        // ולידציות בסיסיות
        if (!file || !bookName) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

        // 1. אבטחה: בדיקת סוג קובץ (MIME Type) בנוסף לסיומת
        // אנו מוודאים שהדפדפן מזהה את זה כטקסט פשוט
        if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
            return NextResponse.json({ error: 'רק קבצי טקסט (.txt) מותרים' }, { status: 400 });
        }

        // 2. אבטחה: הגבלת גודל קובץ (למשל 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 10MB)' }, { status: 400 });
        }

        const content = await file.text();

        // 3. אבטחה: בדיקה שהתוכן לא מכיל תווים בינאריים חשודים (Null Bytes)
        // זה מונע העלאת קבצי הרצה שהוסוו כטקסט
        if (content.indexOf('\0') !== -1) {
             return NextResponse.json({ error: 'הקובץ מכיל תווים לא חוקיים' }, { status: 400 });
        }

        await connectDB();

        // יצירת רשומה ב-DB
        const upload = await Upload.create({
            uploader: session.user._id,
            bookName: bookName,
            originalFileName: file.name,
            content: content,
            fileSize: file.size,
            lineCount: content.split('\n').length,
            status: 'pending'
        });

        return NextResponse.json({ 
            success: true, 
            message: 'הספר הועלה בהצלחה',
            upload: {
                id: upload._id,
                bookName: upload.bookName,
                status: upload.status,
                uploadedAt: upload.createdAt
            }
        });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ success: false, error: 'שגיאה בהעלאה' }, { status: 500 });
    }
}

// קבלת ההיסטוריה של המשתמש (ללא שינוי, נשאר לצורך שלמות הקובץ)
export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ success: true, uploads: [] }); 

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId'); 

        if (userId && userId !== session.user._id && session.user.role !== 'admin') {
             return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await connectDB();
        
        const uploads = await Upload.find({ uploader: session.user._id })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return NextResponse.json({ 
            success: true, 
            uploads: uploads.map(u => ({
                id: u._id,
                bookName: u.bookName,
                uploadedAt: u.createdAt,
                status: u.status,
                fileName: u.originalFileName
            }))
        });

    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}