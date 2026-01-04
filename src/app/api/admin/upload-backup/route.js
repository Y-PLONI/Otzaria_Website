import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: "No file found" });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // שמירת הקובץ בתיקיית השורש של הפרויקט
    const filePath = path.join(process.cwd(), file.name);
    await writeFile(filePath, buffer);

    return NextResponse.json({ success: true, path: filePath });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message });
  }
}