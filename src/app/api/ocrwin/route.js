import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. קבלת ה-FormData מהדפדפן
    const incomingData = await request.formData();
    const file = incomingData.get('file'); // זה ה-Blob (הקובץ)

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 2. הכנת FormData חדש למשלוח לשרת המרוחק
    const remoteFormData = new FormData();
    // אנחנו מוסיפים את הקובץ ונותנים לו שם כדי שהשרת יזהה אותו
    remoteFormData.append('file', file, 'image.jpg');

    const remoteUrl = process.env.OCRWIN_URL;
    const apiKey = process.env.OCRWIN_API_KEY;

    // 3. שליחה לשרת המרוחק כ-Multipart Form Data
    const response = await fetch(remoteUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        // לא מגדירים Content-Type ידנית כששולחים FormData ב-fetch, 
        // הדפדפן/צד השרת יעשה זאת לבד עם ה-Boundary הנכון.
      },
      body: remoteFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Remote server error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      text: data.text || data.content || (typeof data === 'string' ? data : '') 
    });

  } catch (error) {
    console.error('OCRWIN Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}