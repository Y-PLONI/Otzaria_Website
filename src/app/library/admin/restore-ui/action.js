'use server'

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export async function uploadFileAction(formData) {
  try {
    const file = formData.get('file');

    if (!file) {
      return { success: false, error: "No file found" };
    }

    const filePath = path.join(process.cwd(), file.name);
    
    // --- השינוי הגדול: הזרמה (Streaming) ---
    // במקום לטעון את כל הקובץ לזיכרון עם arrayBuffer
    // אנחנו יוצרים "צינור" מהדפדפן ישר לדיסק
    
    const webStream = file.stream(); // קבלת הזרם מהדפדפן
    const nodeStream = Readable.fromWeb(webStream); // המרה לזרם של Node.js
    const writeStream = fs.createWriteStream(filePath); // פתיחת קובץ לכתיבה

    // הזרמת המידע (זה לא תופס זיכרון)
    await pipeline(nodeStream, writeStream);

    return { success: true, path: filePath };
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}