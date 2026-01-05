#!/usr/bin/env node

/**
 * migrate-complete-final.js
 * סקריפט שחזור אולטימטיבי למבנה הנתונים של אוצריא.
 * כולל Parser ייעודי לקבצי ה-JSON המיוחדים (Concatenated Objects).
 */

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

// --- הגדרות ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_db';
const FILES_JSON_PATH = path.join(process.cwd(), 'files.json');
const BACKUPS_JSON_PATH = path.join(process.cwd(), 'backups.json');
const MESSAGES_JSON_PATH = path.join(process.cwd(), 'messages.json');

// --- הגדרת סכמות (Schemas) ---
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    points: { type: Number, default: 0 },
}, { timestamps: true });

const BookSchema = new Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, index: true },
    totalPages: { type: Number, default: 0 },
    completedPages: { type: Number, default: 0 },
    category: { type: String, default: 'כללי' },
    folderPath: { type: String },
}, { timestamps: true });

const PageSchema = new Schema({
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    pageNumber: { type: Number, required: true },
    content: { type: String, default: '' },
    status: { type: String, enum: ['available', 'in-progress', 'completed'], default: 'available' },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    claimedAt: Date,
    completedAt: Date,
    imagePath: { type: String, required: true }
}, { timestamps: true });

// אינדקס ייחודי למניעת כפילויות
PageSchema.index({ book: 1, pageNumber: 1 }, { unique: true });

const UploadSchema = new Schema({
    uploader: { type: Schema.Types.ObjectId, ref: 'User' },
    bookName: { type: String, required: true },
    originalFileName: { type: String },
    content: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const MessageSchema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String, default: 'ללא נושא' },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    replies: [{
        sender: { type: Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// יצירת מודלים
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// --- פונקציות עזר לניקוי נתונים ---

/**
 * מנרמל שמות קבצים כדי למצוא התאמה בין ה-Uploads לקבצי התוכן.
 * מטפל בקידוד URL, סיומות וחותמות זמן.
 */
function normalizeKey(filePathOrName) {
    if (!filePathOrName) return '';

    // 1. חילוץ שם הקובץ מהנתיב
    let name = filePathOrName.split('/').pop(); 

    // 2. פענוח URL Encoded (למשל %D7%90 -> א)
    try {
        name = decodeURIComponent(name);
    } catch (e) { }

    // 3. הסרת סיומת קובץ
    name = name.replace(/\.[^/.]+$/, "");

    // 4. הסרת חותמות זמן ארוכות בסוף הקובץ (למשל _1767556478342)
    // ה-Regex מחפש קו תחתון ואחריו לפחות 10 ספרות בסוף המחרוזת
    name = name.replace(/_\d{10,}.*$/, '');

    return name.trim();
}

/**
 * יצירת סלאג (Slug)
 */
function createSlug(name) {
    if (!name) return 'unknown-' + Date.now();
    return name.trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF\-]/g, '')
        .toLowerCase() || 'book-' + Date.now();
}

/**
 * המרת אובייקטים מיוחדים של מונגו לערכים רגילים
 */
function extractValue(val) {
    if (val && typeof val === 'object') {
        if (val.$numberInt) return parseInt(val.$numberInt);
        if (val.$oid) return val.$oid;
        if (val.$date && val.$date.$numberLong) return new Date(parseInt(val.$date.$numberLong));
        if (val.$date) return new Date(val.$date);
    }
    return val;
}

/**
 * המרת תאריך בטוחה
 */
function safeDate(d) {
    if (!d) return new Date();
    const date = new Date(extractValue(d));
    return isNaN(date.getTime()) ? new Date() : date;
}

// --- פונקציית הקריאה המיוחדת (Parser) ---

/**
 * קורא קובץ שמכיל רצף של אובייקטי JSON (לא מופרדים בפסיקים ולא עטופים במערך).
 * מטפל בבעיות זיכרון ע"י קריאה חכמה.
 */
function parseStreamedJsonFileSync(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ הקובץ לא נמצא: ${filePath}`);
        return [];
    }

    console.log(`📖 מתחיל לקרוא את ${path.basename(filePath)} (קריאה מתקדמת)...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const content = fileBuffer.toString('utf8');
    const objects = [];
    
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];

        // טיפול במחרוזות כדי לא לספור סוגריים בתוכן טקסטואלי
        if (char === '"' && !isEscaped) {
            inString = !inString;
        }
        
        if (!isEscaped && char === '\\') {
            isEscaped = true;
        } else {
            isEscaped = false;
        }

        if (!inString) {
            if (char === '{') {
                if (braceCount === 0) startIndex = i;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIndex !== -1) {
                    // מצאנו אובייקט שלם
                    const jsonStr = content.substring(startIndex, i + 1);
                    try {
                        const obj = JSON.parse(jsonStr);
                        objects.push(obj);
                    } catch (e) {
                        // התעלם משגיאות פרסור נקודתיות
                    }
                    startIndex = -1;
                }
            }
        }
    }

    console.log(`✅ הצלחנו לחלץ ${objects.length} אובייקטים מ-${path.basename(filePath)}`);
    return objects;
}

// --- משתנים גלובליים למיפוי ---
const userIdMapping = new Map(); // Old ID -> New ObjectId
const contentMap = new Map();    // Normalized Key -> Text Content

// --- הלוגיקה הראשית ---

async function main() {
    try {
        console.log('🚀 מתחיל תהליך שחזור נתונים מלא (גרסה מתוקנת)...');
        
        // 1. התחברות
        await mongoose.connect(MONGODB_URI);
        console.log('✅ מחובר למסד הנתונים.');

        // 2. ניקוי
        console.log('🧹 מנקה נתונים קיימים...');
        await Promise.all([
            User.deleteMany({}),
            Book.deleteMany({}),
            Page.deleteMany({}),
            Upload.deleteMany({}),
            Message.deleteMany({})
        ]);
        console.log('✅ המסד נקי.');

        // 3. טעינת files.json ומיפוי תוכן
        // זה השלב הקריטי - קריאת כל האובייקטים מהקובץ הגדול
        const filesData = parseStreamedJsonFileSync(FILES_JSON_PATH);
        
        // איתור קבצי מטא-דאטה מתוך הנתונים שקראנו
        let usersRawData = null;
        let uploadsMetaRawData = null;

        console.log('📝 בונה אינדקס תוכן...');
        
        filesData.forEach(item => {
            // שמירת הפניות לקבצי מטא-דאטה חשובים שנמצאים בתוך files.json
            if (item.path === 'data/users.json') usersRawData = item.data;
            if (item.path === 'data/uploads-meta.json') uploadsMetaRawData = item.data;

            // שמירת תוכן (טקסט) של קבצים רלוונטיים
            if (item.data && typeof item.data.content === 'string' && item.data.content.length > 0) {
                if (item.path.includes('data/content/') || item.path.includes('data/uploads/')) {
                    const normalized = normalizeKey(item.path);
                    contentMap.set(normalized, item.data.content);
                    
                    // שמירה גם עם רווחים במקום קו תחתון (למקרה של אי-התאמה)
                    if (normalized.includes('_')) {
                        contentMap.set(normalized.replace(/_/g, ' '), item.data.content);
                    }
                }
            }
        });

        console.log(`📊 נטענו ${contentMap.size} רשומות תוכן לזיכרון.`);

        // 4. שחזור משתמשים
        if (usersRawData && Array.isArray(usersRawData)) {
            console.log(`👥 משחזר ${usersRawData.length} משתמשים...`);
            for (const u of usersRawData) {
                if (!u.email) continue;
                try {
                    const newUser = await User.create({
                        name: u.name || `User_${u.id}`,
                        email: u.email,
                        password: u.password || '$2b$10$PlaceholderHashForSecurity', 
                        role: u.role || 'user',
                        points: extractValue(u.points) || 0,
                        createdAt: safeDate(u.createdAt),
                        updatedAt: safeDate(u.updatedAt)
                    });
                    userIdMapping.set(u.id, newUser._id);
                } catch (e) { /* ignore duplicates */ }
            }
            console.log('✅ שחזור משתמשים הושלם.');
        } else {
            console.log('⚠️ לא נמצאו נתוני משתמשים ב-files.json');
        }

        // 5. שחזור Uploads (קבצים שהועלו)
        if (uploadsMetaRawData && Array.isArray(uploadsMetaRawData)) {
            console.log(`📤 משחזר ${uploadsMetaRawData.length} העלאות...`);
            let matchedContentCount = 0;

            for (const meta of uploadsMetaRawData) {
                if (!meta.bookName) continue;

                let content = '';
                const originalName = meta.fileName || meta.originalFileName || '';
                
                // חיפוש חכם של התוכן
                let searchKey = normalizeKey(originalName);
                if (contentMap.has(searchKey)) {
                    content = contentMap.get(searchKey);
                } else {
                    // נסיון נוסף עם פענוח כפול
                    try {
                        const decodedKey = normalizeKey(decodeURIComponent(originalName));
                        if (contentMap.has(decodedKey)) {
                            content = contentMap.get(decodedKey);
                        }
                    } catch(e) {}
                }

                if (content) matchedContentCount++;

                await Upload.create({
                    uploader: userIdMapping.get(meta.uploadedById) || null,
                    bookName: meta.bookName,
                    originalFileName: originalName,
                    content: content || '', 
                    status: meta.status || 'pending',
                    reviewedBy: userIdMapping.get(meta.reviewedById),
                    createdAt: safeDate(meta.uploadedAt),
                    updatedAt: safeDate(meta.uploadedAt)
                });
            }
            console.log(`✅ שחזור Uploads הושלם. נמצא תוכן עבור ${matchedContentCount} קבצים.`);
        }

        // 6. שחזור ספרים ועמודים (מתוך backups.json)
        const backupsRaw = parseStreamedJsonFileSync(BACKUPS_JSON_PATH);
        
        // סינון: לוקחים רק את הגרסה האחרונה של כל ספר
        const uniqueBooksMap = new Map();
        backupsRaw.forEach(item => {
            if (item.path && item.path.includes('data/pages/') && item.data) {
                const bookName = normalizeKey(item.path);
                // דורסים כל פעם - כך נשארים עם הגרסה האחרונה בקובץ (שהיא העדכנית ביותר)
                uniqueBooksMap.set(bookName, item.data);
            }
        });

        console.log(`📚 זוהו ${uniqueBooksMap.size} ספרים ייחודיים לשחזור.`);

        for (const [bookName, pagesData] of uniqueBooksMap.entries()) {
            if (!Array.isArray(pagesData)) continue;

            const book = await Book.create({
                name: bookName,
                slug: createSlug(bookName),
                totalPages: pagesData.length,
                completedPages: pagesData.filter(p => p.status === 'completed').length,
                category: 'כללי',
                folderPath: `/uploads/books/${createSlug(bookName)}`
            });

            const pagesToInsert = [];

            for (const p of pagesData) {
                const pageNum = extractValue(p.number);
                
                // חיפוש תוכן לעמוד
                let pageContent = p.content || '';

                if (!pageContent) {
                    // וריאציות חיפוש בקבצי התוכן
                    const keysToTry = [
                        `${bookName}_page_${pageNum}`,
                        `${bookName}_עמוד_${pageNum}`,
                        `${bookName} _ עמוד ${pageNum}`,
                        `${bookName} page ${pageNum}`
                    ];

                    for (const key of keysToTry) {
                        const normalizedKey = normalizeKey(key);
                        if (contentMap.has(normalizedKey)) {
                            pageContent = contentMap.get(normalizedKey);
                            break;
                        }
                    }
                }

                pagesToInsert.push({
                    book: book._id,
                    pageNumber: pageNum,
                    content: pageContent,
                    status: p.status || 'available',
                    claimedBy: userIdMapping.get(p.claimedById),
                    claimedAt: safeDate(p.claimedAt),
                    completedAt: safeDate(p.completedAt),
                    imagePath: p.thumbnail || `/uploads/books/${book.slug}/page.${pageNum}.jpg`,
                    createdAt: safeDate(p.createdAt),
                    updatedAt: safeDate(p.updatedAt)
                });
            }

            if (pagesToInsert.length > 0) {
                await Page.insertMany(pagesToInsert);
            }
        }
        console.log('✅ שחזור ספרים ועמודים הושלם.');

        // 7. שחזור הודעות (Messages)
        const messagesData = parseStreamedJsonFileSync(MESSAGES_JSON_PATH);
        
        let msgCount = 0;
        for (const msg of messagesData) {
            if (!msg.message && !msg.content) continue;

            const senderId = userIdMapping.get(msg.senderId);
            const recipientId = userIdMapping.get(msg.recipientId);

            const replies = (msg.replies || []).map(r => ({
                sender: userIdMapping.get(r.senderId),
                content: r.message || r.content,
                createdAt: safeDate(r.createdAt)
            }));

            await Message.create({
                sender: senderId || null, 
                recipient: recipientId || null, 
                subject: msg.subject || 'ללא נושא',
                content: msg.message || msg.content,
                isRead: msg.status === 'read' || !!msg.readAt,
                replies: replies,
                createdAt: safeDate(msg.createdAt),
                updatedAt: safeDate(msg.updatedAt)
            });
            msgCount++;
        }
        console.log(`✅ שחזור ${msgCount} הודעות הושלם.`);

        console.log('\n=====================================');
        console.log('🎉 מיגרציה הושלמה בהצלחה!');
        console.log('=====================================');
        
        process.exit(0);

    } catch (error) {
        console.error('\n❌ שגיאה קריטית במהלך המיגרציה:');
        console.error(error);
        process.exit(1);
    }
}

// הרצה
main();