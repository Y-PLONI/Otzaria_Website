import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { uploadIds } = await request.json();
    
    if (!uploadIds || !Array.isArray(uploadIds) || uploadIds.length === 0) {
      return NextResponse.json({ error: 'Upload IDs array is required' }, { status: 400 });
    }

    await connectDB();
    
    // שליפת כל הקבצים
    const uploads = await Upload.find({ _id: { $in: uploadIds } });
    
    if (uploads.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }

    // איחוד התוכן של כל הקבצים עם 2 מעברי שורות ביניהם
    const combinedContent = uploads
      .map(upload => upload.content)
      .join('\n\n');

    // החזרת הקובץ המאוחד
    return new NextResponse(combinedContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="combined_uploads_${new Date().toISOString().split('T')[0]}.txt"`
      }
    });

  } catch (error) {
    console.error('Error downloading batch:', error);
    return NextResponse.json({ error: 'Failed to download batch' }, { status: 500 });
  }
}
