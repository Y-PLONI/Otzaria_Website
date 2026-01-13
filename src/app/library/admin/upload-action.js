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
import { processBatchWithGemini } from '@/lib/gemini';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');

export async function uploadBookAction(formData) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
        return { success: false, error: 'אין הרשאות ניהול' };
    }

    await connectDB();
    
    const file = formData.get('pdf');
    const bookName = formData.get('bookName');
    const category = formData.get('category') || 'כללי';
    const layoutType = formData.get('layoutType') || 'single_column';
    const scriptType = formData.get('scriptType') || 'square';
    const customPrompt = formData.get('customPrompt') || '';

    if (!file || !bookName) {
      return { success: false, error: 'חסרים נתונים' };
    }

    // 1. יצירת תיקייה
    const slug = slugify(bookName, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g }) + '-' + Date.now();
    const bookFolder = path.join(UPLOAD_ROOT, 'books', slug);
    await fs.ensureDir(bookFolder);

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    const tempPdfPath = path.join(bookFolder, 'source.pdf');
    await fs.writeFile(tempPdfPath, pdfBuffer);

    // 2. המרה לתמונות
    const options = {
      density: 150,
      saveFilename: "page",
      savePath: bookFolder,
      format: "jpg",
      width: 1200,
      height: 1600 
    };

    const convert = fromPath(tempPdfPath, options);
    const result = await convert.bulk(-1, { responseType: "image" });
    
    if (!result || result.length === 0) {
      throw new Error('Conversion failed');
    }

    // 3. שליפת דוגמאות
    const examples = await OcrExample.find({ scriptType, layoutType }).lean();

    // 4. יצירת הספר
    const newBook = await Book.create({
      name: bookName,
      slug: slug,
      category: category,
      folderPath: `/uploads/books/${slug}`,
      totalPages: result.length,
      completedPages: 0,
      editingInfo: { 
          title: 'הנחיות עריכה', 
          sections: [{ title: 'הנחיות AI', items: [customPrompt || 'ערוך את הטקסט שנוצר ע"י ה-AI'] }] 
      }
    });

    const imagePaths = [];
    const pagesData = [];

    // האם הספר הוא דו-טורי (גם אם זה הסכמה המורכבת)
    const isTwoCols = layoutType === 'double_column' || layoutType === 'complex_columns';

    result.forEach((page, index) => {
        const pageNum = index + 1;
        const relativePath = `/uploads/books/${slug}/page.${pageNum}.jpg`;
        const fullPath = path.join(bookFolder, `page.${pageNum}.jpg`);
        
        imagePaths.push(fullPath);
        
        pagesData.push({
            book: newBook._id,
            pageNumber: pageNum,
            imagePath: relativePath,
            status: 'available',
            content: '',
            isTwoColumns: isTwoCols
        });
    });

    // 5. OCR במנות
    const BATCH_SIZE = 10;
    const finalPagesData = [...pagesData];

    for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
        const batchImages = imagePaths.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i; 

        try {
            console.log(`Processing batch ${i / BATCH_SIZE + 1} with ${layoutType}...`);
            
            const ocrResults = await processBatchWithGemini(
                batchImages, 
                layoutType, 
                customPrompt, 
                examples
            );

            if (Array.isArray(ocrResults)) {
                ocrResults.forEach((res) => {
                    // המרה ממספר עמוד יחסי (1-10) לאינדקס גלובלי
                    const relativePageNum = res.page_number; 
                    const globalIndex = batchStartIndex + (relativePageNum - 1);

                    if (finalPagesData[globalIndex]) {
                        const targetPage = finalPagesData[globalIndex];
                        
                        // טיפול בסוגים השונים של פלט
                        if (layoutType === 'complex_columns' && res.columns) {
                            // טיפול בסכמה המורכבת החדשה
                            // המודל מחזיר מערך של אובייקטים: [{ side: 'right', text: '...' }, { side: 'left', text: '...' }]
                            const rightText = res.columns.filter(c => c.side === 'right').map(c => c.text).join('\n');
                            const leftText = res.columns.filter(c => c.side === 'left').map(c => c.text).join('\n');
                            const centerText = res.columns.filter(c => c.side === 'center').map(c => c.text).join('\n'); // אם יש כותרות אמצע

                            targetPage.rightColumn = rightText;
                            targetPage.leftColumn = leftText;
                            
                            // התוכן הראשי לחיפוש יכיל הכל
                            targetPage.content = [centerText, rightText, leftText].filter(Boolean).join('\n');

                        } else if (layoutType === 'double_column') {
                            // טיפול בסכמה השטוחה הישנה
                            targetPage.rightColumn = res.right_column || '';
                            targetPage.leftColumn = res.left_column || '';
                            targetPage.content = (res.right_column || '') + '\n' + (res.left_column || '');
                        } else {
                            // טור אחד
                            targetPage.content = res.content || '';
                        }
                    }
                });
            }

        } catch (ocrError) {
            console.error(`Error in OCR batch starting at index ${i}:`, ocrError);
        }
    }

    // 6. שמירה
    await Page.insertMany(finalPagesData);
    await fs.remove(tempPdfPath); 

    return { 
      success: true, 
      message: 'הספר הועלה ועובד בהצלחה',
      bookId: newBook._id.toString() 
    };

  } catch (error) {
    console.error('Upload Error:', error);
    return { success: false, error: error.message };
  }
}