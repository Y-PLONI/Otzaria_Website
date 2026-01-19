import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import fs from 'fs-extra';

/**
 * אתחול הלקוח של גוגל
 * יוצרים מופע של GoogleGenAI עם מפתח ה-API
 */
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not defined in environment variables!');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * העלאת קובץ ל-Gemini Files API
 * @param {string} filePath - נתיב פיזי לקובץ JPG
 * @param {string} displayName - שם מזהה לצורכי ניהול בגוגל (לא בשימוש - מושאר ריק)
 * @returns {Promise<Object>} - אובייקט הקובץ הכולל את ה-URI (כולל uri, name, mimeType)
 */
export async function uploadFileToGemini(filePath, displayName) {
  try {
    // בדיקה שהקובץ קיים לפני העלאה
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    console.log(`☁️ Uploading to Gemini Cloud: ${filePath}...`);

    // קריאת הקובץ כ-Buffer
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    console.log(`📦 File size: ${fileBuffer.length} bytes, base64 length: ${base64Data.length}`);

    // שימוש ב-File API עם FormData (השיטה המומלצת מהתיעוד)
    const apiKey = process.env.GEMINI_API_KEY;
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;

    console.log('🚀 Uploading via REST API...');

    // יצירת metadata
    const metadata = {
      file: {
        mimeType: 'image/jpeg'
      }
    };

    // שליחת בקשת POST עם multipart/form-data
    const FormData = (await import('formdata-node')).FormData;
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }));

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Upload failed:', response.status, response.statusText);
      console.error('❌ Error body:', errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const uploadedFile = await response.json();
    console.log(`✅ Uploaded file:`, uploadedFile);

    // המבנה המוחזר צריך להכיל file.uri או uri
    const fileUri = uploadedFile.file?.uri || uploadedFile.uri;
    if (!fileUri) {
      console.error('❌ No URI in response:', uploadedFile);
      throw new Error('No URI returned from upload');
    }

    return {
      uri: fileUri,
      name: uploadedFile.file?.name || uploadedFile.name,
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    console.error(`❌ Error in uploadFileToGemini:`, error);
    console.error(`❌ Error stack:`, error.stack);
    throw error;
  }
}

/**
 * עיבוד אצווה של עד 10 עמודים מול המודל
 * @param {Array<string>} pagesUris - מערך של URIs (מגוגל) של העמודים לעיבוד
 * @param {Array<Object>} examplesContext - מערך דוגמאות {uri, expectedOutput}
 * @param {string} layoutType - סוג הפריסה (single_column / double_column / complex_columns)
 * @param {string} specificPrompt - הוראות נוספות מהמשתמש
 */
export async function processOcrBatch(pagesUris, examplesContext, layoutType, specificPrompt) {
  try {
    // הגדרת הוראות המערכת - המודל יתנהג כסורק OCR מקצועי
    const systemInstruction = `You are a professional Hebrew OCR specialist. 
Your goal is to transcribe images of Hebrew books into clean, accurate text.
- Maintain original spelling and abbreviations (e.g., ").
- If layout is 'double_column', provide "right_column" and "left_column" fields.
- If layout is 'single_column', provide all text in the "content" field.
- For 'complex_columns', try to identify different blocks of text.
- Output MUST be a valid JSON array of objects. Each object represents one page in the order provided.
- Schema per page object: {"page_number": number, "content": "string", "right_column": "string", "left_column": "string"}
- Return ONLY the JSON array. No markdown tags or conversational filler.`;

    // בניית תוכן ההודעה - parts שישולבו ב-createUserContent
    const contentParts = [];

    // 1. הוספת הוראות המערכת
    contentParts.push(systemInstruction);

    // 2. הוספת דוגמאות (Few-Shot) מהענן
    if (examplesContext && examplesContext.length > 0) {
      contentParts.push("REFERENCE EXAMPLES FOR FORMAT AND ACCURACY:");
      examplesContext.forEach(ex => {
        contentParts.push(createPartFromUri(ex.uri, 'image/jpeg'));
        contentParts.push(`Expected JSON for this page: ${JSON.stringify(ex.expectedOutput)}`);
      });
    }

    // 3. הוספת הנחיות ספציפיות לספר הנוכחי
    if (specificPrompt) {
      contentParts.push(`IMPORTANT - ADDITIONAL INSTRUCTIONS: ${specificPrompt}`);
    }

    // 4. הוספת העמודים של האצווה הנוכחית
    contentParts.push(`NOW, TRANSCRIBE THESE ${pagesUris.length} PAGES IN ORDER:`);
    pagesUris.forEach((uri) => {
      contentParts.push(createPartFromUri(uri, 'image/jpeg'));
    });

    console.log(`📡 Sending batch of ${pagesUris.length} pages to Gemini...`);

    // שליחת הבקשה עם הגדרות JSON mode
    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: createUserContent(contentParts),
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '';

    // ניקוי שאריות אם המודל חרג מהפורמט (נדיר ב-JSON mode)
    const cleanJson = responseText.replace(/```json|```/g, '').trim();

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("❌ Gemini API Error in processOcrBatch:", error);
    throw error;
  }
}