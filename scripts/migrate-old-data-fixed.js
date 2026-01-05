#!/usr/bin/env node

/**
 * migrate-complete-final.js
 * סקריפט שחזור מלא למערכת אוצריא.
 * מטפל בקריאת קבצי JSON גדולים, פענוח שמות בעברית, ניקוי חותמות זמן,
 * ואיחוד נתונים ממקורות שונים (קבצים + מטא-דאטה).
 */

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const readline = require('readline');

// --- הגדרות סביבה ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_db';

// נתיבי הקבצים - מניחים שהם בתיקיית השורש
const FILES_JSON_PATH = path.join(process.cwd(), 'files.json');
const BACKUPS_JSON_PATH = path.join(process.cwd(), 'backups.json');
const MESSAGES_JSON_PATH = path.join(process.cwd(), 'messages.json');

// --- הגדרת סכמות (Schemas) ---
// מוגדרות כאן כדי שהסקריפט יהיה עצמאי לחלוטין ללא תלות בקבצים חיצוניים

const Schema = mongoose.Schema;

const UserSchema = new Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // מוצפן
    role: { type: String, enum: ['user', 'admin', 'editor'], default: 'user' },
    points: { type: Number, default: 0 },
}, { timestamps: true });

const BookSchema = new Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, index: true },
    totalPages: { type: Number, default: 0 },
    completedPages: { type: Number, default: 0 },
    category: { type: String, default: 'כללי' },
    folderPath: { type: String }, // נתיב וירטואלי לתמונות
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

// אינדקס למניעת כפילויות עמודים
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
    recipient: { type: Schema.Types.ObjectId, ref: 'User' }, // null = הודעת מערכת/לכולם
    subject: { type: String, default: 'ללא נושא' },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    replies: [{
        sender: { type: Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

// יצירת מודלים (מונע שגיאת OverwriteModelError בהרצה חוזרת באותו Process)
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// --- פונקציות עזר לנירמול וניקוי נתונים ---

/**
 * הפונקציה החשובה ביותר לתיקון הבעיה:
 * מנקה שמות קבצים מקידוד URL, סיומות, וחותמות זמן.
 */
function normalizeKey(filePathOrName) {
    if (!filePathOrName) return '';

    // 1. חילוץ שם הקובץ מהנתיב המלא
    let name = filePathOrName.split('/').pop(); 

    // 2. פענוח URL Encoded (למשל %D7%90 -> א)
    try {
        name = decodeURIComponent(name);
    } catch (e) {
        // אם הפענוח נכשל, נשארים עם המקור
    }

    // 3. הסרת סיומת קובץ (.txt, .json וכו')
    name = name.replace(/\.[^/.]+$/, "");

    // 4. הסרת חותמות זמן (Timestamp) בסוף הקובץ
    // מחפש קו תחתון ואחריו לפחות 10 ספרות בסוף המחרוזת (למשל _1767556478342)
    name = name.replace(/_\d{10,}.*$/, '');

    // 5. ניקוי רווחים מיותרים
    return name.trim();
}

/**
 * יצירת סלאג (Slug) חוקי ל-URL
 */
function createSlug(name) {
    if (!name) return 'unknown-' + Date.now();
    return name.trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF\-]/g, '')
        .toLowerCase();
}

/**
 * טיפול באובייקטים מיוחדים של MongoDB מקבצי הגיבוי הישנים
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

/**
 * קורא קובץ JSON גדול ומחזיר מערך של אובייקטים.
 * מטפל בשני פורמטים:
 * 1. קובץ שמכיל מערך JSON תקני []
 * 2. קובץ שמכיל זרם של אובייקטים {} {} (JSON Lines או סתם שרשור)
 */
async function parseLargeJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ הקובץ לא נמצא: ${filePath}`);
        return [];
    }

    console.log(`📖 קורא את הקובץ: ${path.basename(filePath)}...`);
    
    // קריאת כל הקובץ לזיכרון (הנחה שיש מספיק RAM, במידה ולא יש לעבור ל-Stream)
    const content = fs.readFileSync(filePath, 'utf8').trim();

    try {
        // נסיון ראשון: פרסור רגיל
        return JSON.parse(content);
    } catch (e) {
        console.log(`ℹ️ פרסור רגיל נכשל, מנסה פרסור מתקדם עבור ${path.basename(filePath)}...`);
        
        // נסיון שני: תיקון מבנה של אובייקטים משורשרים
        // הופך } { ל- }, {
        const fixedContent = '[' + content.replace(/}\s*{/g, '},{') + ']';
        try {
            return JSON.parse(fixedContent);
        } catch (e2) {
            console.error(`❌ שגיאה בקריאת הקובץ ${filePath}. מדלג.`);
            return [];
        }
    }
}

// --- משתנים גלובליים לניהול המיפוי ---
const userIdMapping = new Map(); // מזהה ישן -> מזהה מונגו חדש
const contentMap = new Map();    // מפתח מנורמל -> תוכן הטקסט

// --- הפונקציה הראשית ---

async function main() {
    try {
        console.log('🚀 מתחיל תהליך שחזור נתונים מלא...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ מחובר למסד הנתונים.');

        // שלב 0: ניקוי המסד
        console.log('🧹 מנקה נתונים קיימים...');
        await Promise.all([
            User.deleteMany({}),
            Book.deleteMany({}),
            Page.deleteMany({}),
            Upload.deleteMany({}),
            Message.deleteMany({})
        ]);
        console.log('✅ המסד נקי.');

        // ==========================================
        // שלב 1: טעינת files.json ומיפוי התוכן
        // ==========================================
        // זה השלב הקריטי לפתרון הבעיה של נתונים חסרים.
        // אנחנו טוענים הכל לזיכרון וממפים לפני שיוצרים רשומות ב-DB.
        
        const filesData = await parseLargeJsonFile(FILES_JSON_PATH);
        
        let usersRawData = null;
        let uploadsMetaRawData = null;

        console.log(`🔍 מנתח ${filesData.length} רשומות מקובץ files.json...`);

        filesData.forEach(item => {
            // שמירת הפניות לקבצי מטא-דאטה חשובים
            if (item.path === 'data/users.json') usersRawData = item.data;
            if (item.path === 'data/uploads-meta.json') uploadsMetaRawData = item.data;

            // בניית מפת התוכן (Content Map)
            // נשמור תוכן רק אם הוא מחרוזת לא ריקה
            if (item.data && typeof item.data.content === 'string' && item.data.content.length > 0) {
                const normalized = normalizeKey(item.path);
                
                // שמירה במפה לפי מפתח מנורמל
                contentMap.set(normalized, item.data.content);
                
                // שמירה גם של וריאציה עם רווחים במקום קווים תחתונים (למקרים של אי-התאמה)
                if (normalized.includes('_')) {
                    contentMap.set(normalized.replace(/_/g, ' '), item.data.content);
                }
            }
        });

        console.log(`📊 מפת התוכן מכילה ${contentMap.size} ערכים.`);

        // ==========================================
        // שלב 2: שחזור משתמשים
        // ==========================================
        if (usersRawData && Array.isArray(usersRawData)) {
            console.log(`👥 משחזר ${usersRawData.length} משתמשים...`);
            
            for (const u of usersRawData) {
                if (!u.email) continue; // דילוג על משתמשים פגומים

                try {
                    const newUser = await User.create({
                        name: u.name || `User_${u.id}`,
                        email: u.email,
                        password: u.password || '$2b$10$PlaceholderHashForSecurity', // חייב סיסמה
                        role: u.role || 'user',
                        points: extractValue(u.points) || 0,
                        createdAt: safeDate(u.createdAt),
                        updatedAt: safeDate(u.updatedAt)
                    });
                    
                    // שמירת המיפוי: ID ישן -> ID חדש
                    userIdMapping.set(u.id, newUser._id);
                } catch (e) {
                    console.log(`   ⚠️ שגיאה ביצירת משתמש ${u.email}: ${e.message}`);
                }
            }
            console.log('✅ שחזור משתמשים הושלם.');
        }

        // ==========================================
        // שלב 3: שחזור Uploads (קבצים שהועלו)
        // ==========================================
        // כאן התיקון הגדול: שימוש ב-normalizeKey כדי למצוא את התוכן
        if (uploadsMetaRawData && Array.isArray(uploadsMetaRawData)) {
            console.log(`📤 משחזר ${uploadsMetaRawData.length} העלאות...`);
            
            let matchedContentCount = 0;

            for (const meta of uploadsMetaRawData) {
                if (!meta.bookName) continue;

                // חיפוש התוכן במפה
                let content = '';
                const originalName = meta.fileName || meta.originalFileName || '';
                
                // נסיון 1: נרמול השם מהמטא-דאטה וחיפוש
                let searchKey = normalizeKey(originalName);
                if (contentMap.has(searchKey)) {
                    content = contentMap.get(searchKey);
                }
                
                // נסיון 2: אולי השם במטא-דאטה הוא כבר מקודד?
                if (!content) {
                    try {
                        const decodedKey = normalizeKey(decodeURIComponent(originalName));
                        if (contentMap.has(decodedKey)) {
                            content = contentMap.get(decodedKey);
                        }
                    } catch(e) {}
                }

                if (content) matchedContentCount++;

                await Upload.create({
                    uploader: userIdMapping.get(meta.uploadedById) || null, // אם אין משתמש, זה אנונימי
                    bookName: meta.bookName,
                    originalFileName: originalName,
                    content: content, // התוכן שנמצא (או ריק)
                    status: meta.status || 'pending',
                    reviewedBy: userIdMapping.get(meta.reviewedById),
                    createdAt: safeDate(meta.uploadedAt),
                    updatedAt: safeDate(meta.uploadedAt)
                });
            }
            console.log(`✅ שחזור Uploads הושלם. נמצא תוכן עבור ${matchedContentCount} קבצים.`);
        }

        // ==========================================
        // שלב 4: שחזור ספרים ועמודים (מתוך backups.json)
        // ==========================================
        console.log('📚 טוען ומעבד את backups.json...');
        const backupsRaw = await parseLargeJsonFile(BACKUPS_JSON_PATH);
        
        // יצירת מפה של ספרים ייחודיים (לקיחת הגרסה האחרונה מתוך הגיבויים)
        const uniqueBooksMap = new Map();

        backupsRaw.forEach(item => {
            if (item.path && item.path.includes('data/pages/') && item.data) {
                const bookName = normalizeKey(item.path); // שם הספר מהנתיב
                // דורסים כל פעם כדי לשמור את הגרסה האחרונה ברשימה
                uniqueBooksMap.set(bookName, item.data);
            }
        });

        console.log(`📚 זוהו ${uniqueBooksMap.size} ספרים ייחודיים לשחזור.`);

        for (const [bookName, pagesData] of uniqueBooksMap.entries()) {
            if (!Array.isArray(pagesData)) continue;

            // יצירת הספר
            const book = await Book.create({
                name: bookName,
                slug: createSlug(bookName),
                totalPages: pagesData.length,
                // חישוב עמודים שהושלמו
                completedPages: pagesData.filter(p => p.status === 'completed').length,
                category: 'כללי',
                folderPath: `/uploads/books/${createSlug(bookName)}`
            });

            const pagesToInsert = [];

            for (const p of pagesData) {
                const pageNum = extractValue(p.number);
                
                // חיפוש תוכן לעמוד
                // התוכן יכול להיות בתוך אובייקט העמוד, או בקובץ חיצוני
                let pageContent = p.content || '';

                if (!pageContent) {
                    // חיפוש במפת התוכן שיצרנו קודם
                    // מפתחות אפשריים: BookName_page_1, BookName_עמוד_1
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

        // ==========================================
        // שלב 5: שחזור הודעות (Messages)
        // ==========================================
        console.log('💬 משחזר הודעות...');
        const messagesData = await parseLargeJsonFile(MESSAGES_JSON_PATH);
        
        let msgCount = 0;
        for (const msg of messagesData) {
            // חובה שיהיה תוכן
            if (!msg.message && !msg.content) continue;

            const senderId = userIdMapping.get(msg.senderId);
            const recipientId = userIdMapping.get(msg.recipientId);

            // יצירת אובייקט תגובות
            const replies = (msg.replies || []).map(r => ({
                sender: userIdMapping.get(r.senderId), // יכול להיות null
                content: r.message || r.content,
                createdAt: safeDate(r.createdAt)
            }));

            await Message.create({
                sender: senderId || null, // null = משתמש לא ידוע / מערכת
                recipient: recipientId || null, // null = הודעה כללית/למנהלים
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

        // סיכום
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

// הרצת הסקריפט
main();