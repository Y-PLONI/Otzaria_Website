'use server'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fromPath } from 'pdf2pic';
import path from 'path';
import fs from 'fs-extra';
import slugify from 'slugify';
import connectDB from '@/lib/db';
import Book from '@/models/Book';
import Page from '@/models/Page';
import OcrExample from '@/models/OcrExample';
import { uploadFileToGemini, processOcrBatch } from '@/lib/gemini';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

export async function uploadBookAction(formData) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Admin only' };
    }

    await connectDB();
    
    const file = formData.get('pdf');
    const bookName = formData.get('bookName');
    const category = formData.get('category') || 'כללי';
    const layoutType = formData.get('layoutType') || 'single_column';
    const scriptType = formData.get('scriptType') || 'square';
    const customPrompt = formData.get('customPrompt') || '';
    const exampleId = formData.get('exampleId');

    if (!file || !bookName) return { success: false, error: 'Missing data' };

    // 1. יצירת תיקייה והמרת PDF
    const slug = slugify(bookName, { lower: true, strict: true }) + '-' + Date.now();
    const bookFolder = path.join(UPLOAD_ROOT, 'books', slug);
    await fs.ensureDir(bookFolder);

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const tempPdfPath = path.join(bookFolder, 'source.pdf');
    await fs.writeFile(tempPdfPath, pdfBuffer);

    const convert = fromPath(tempPdfPath, {
      density: 150,
      saveFilename: "page",
      savePath: bookFolder,
      format: "jpg",
      width: 1200,
      height: 1600 
    });

    const images = await convert.bulk(-1, { responseType: "image" });
    if (!images || images.length === 0) throw new Error('PDF conversion failed');

    // 2. העלאת דוגמאות (Few-Shot) - פעם אחת בלבד לכל הספר
    let examplesContext = [];
    const exampleQuery = exampleId ? { _id: exampleId } : { scriptType, layoutType };
    const dbExamples = await OcrExample.find(exampleQuery).limit(2).lean();

    for (const ex of dbExamples) {
      const fullPath = path.join(process.cwd(), 'public', ex.imagePath);
      if (await fs.pathExists(fullPath)) {
        const geminiFile = await uploadFileToGemini(fullPath, `example-${ex._id}`);
        examplesContext.push({
          uri: geminiFile.uri,
          expectedOutput: ex.expectedOutput
        });
      }
    }

    // 3. יצירת הספר ב-DB
    const newBook = await Book.create({
      name: bookName,
      slug,
      category,
      folderPath: `/uploads/books/${slug}`,
      totalPages: images.length,
      editingInfo: { 
        title: 'הנחיות עריכה', 
        sections: [{ title: 'הנחיות אוטומטיות', items: [customPrompt || 'ערוך את הטקסט'] }] 
      }
    });

    // 4. העלאת כל עמודי הספר ל-Gemini Files API (לפני העיבוד)
    const uploadedPages = [];
    for (const img of images) {
      const filePath = path.join(bookFolder, `page.${img.page}.jpg`);
      const geminiFile = await uploadFileToGemini(filePath, `book-${slug}-p${img.page}`);
      uploadedPages.push({
        uri: geminiFile.uri,
        pageNumber: img.page,
        localPath: `/uploads/books/${slug}/page.${img.page}.jpg`
      });
    }

    // 5. עיבוד באצוות של 10 עמודים
    const BATCH_SIZE = 10;
    const finalPagesData = [];
    
    for (let i = 0; i < uploadedPages.length; i += BATCH_SIZE) {
      const currentBatch = uploadedPages.slice(i, i + BATCH_SIZE);
      const uris = currentBatch.map(p => p.uri);
      
      console.log(`📡 Processing Batch ${Math.floor(i/BATCH_SIZE) + 1}...`);
      
      try {
        const ocrResults = await processOcrBatch(uris, examplesContext, layoutType, customPrompt);
        
        // מיפוי התוצאות חזרה לעמודים
        currentBatch.forEach(page => {
          const result = Array.isArray(ocrResults) 
            ? ocrResults.find(r => r.page_number === page.pageNumber)
            : null;

          finalPagesData.push({
            book: newBook._id,
            pageNumber: page.pageNumber,
            imagePath: page.localPath,
            status: 'available',
            content: result?.content || '',
            rightColumn: result?.right_column || '',
            leftColumn: result?.left_column || '',
            isTwoColumns: layoutType !== 'single_column'
          });
        });
      } catch (batchError) {
        console.error(`❌ Batch failed:`, batchError);
        // במקרה של שגיאה קריטית באצווה, ניצור רשומות ריקות
        currentBatch.forEach(page => {
          finalPagesData.push({
            book: newBook._id,
            pageNumber: page.pageNumber,
            imagePath: page.localPath,
            status: 'available',
            content: ''
          });
        });
      }
    }

    // 6. שמירה ל-DB וניקוי
    await Page.insertMany(finalPagesData);
    await fs.remove(tempPdfPath); 

    return { success: true, bookId: newBook._id.toString() };

  } catch (error) {
    console.error('Upload Process Error:', error);
    return { success: false, error: error.message };
  }
}