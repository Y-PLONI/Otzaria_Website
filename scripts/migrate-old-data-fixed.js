#!/usr/bin/env node

/**
 * migrate-complete-final.js
 * סקריפט שחזור אולטימטיבי:
 * 1. קורא נתונים גולמיים בצורה חכמה (כולל סוף קובץ).
 * 2. מפענח שמות קבצים ותוכן.
 * 3. משדך משתמשים בצורה אגרסיבית (ID -> אימייל -> שם).
 * 4. מבצע חישוב מחדש של סטטיסטיקות בסוף הריצה.
 */

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

// --- הגדרות ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_db';
const FILES_JSON_PATH = path.join(process.cwd(), 'files.json');
const BACKUPS_JSON_PATH = path.join(process.cwd(), 'backups.json');
const MESSAGES_JSON_PATH = path.join(process.cwd(), 'messages.json');

// --- הגדרת סכמות ---
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

// --- משתנים גלובליים למיפוי ---
// אנו נשתמש במספר מפות כדי להבטיח שנמצא את המשתמש גם אם ה-ID השתנה
const userIdMap = new Map();    // Old ID -> New ObjectId
const userEmailMap = new Map(); // Email -> New ObjectId
const userNameMap = new Map();  // Name -> New ObjectId
const contentMap = new Map();   // Normalized Filename -> Content

// --- פונקציות עזר ---

function normalizeKey(filePathOrName) {
    if (!filePathOrName) return '';
    let name = filePathOrName.split('/').pop(); 
    try { name = decodeURIComponent(name); } catch (e) { }
    name = name.replace(/\.[^/.]+$/, "");
    name = name.replace(/_\d{10,}.*$/, '');
    return name.trim();
}

function createSlug(name) {
    if (!name) return 'unknown-' + Date.now();
    return name.trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF\-]/g, '')
        .toLowerCase() || 'book-' + Date.now();
}

function extractValue(val) {
    if (val && typeof val === 'object') {
        if (val.$numberInt) return parseInt(val.$numberInt);
        if (val.$oid) return val.$oid;
        if (val.$date && val.$date.$numberLong) return new Date(parseInt(val.$date.$numberLong));
        if (val.$date) return new Date(val.$date);
    }
    return val;
}

function safeDate(d) {
    if (!d) return new Date();
    const date = new Date(extractValue(d));
    return isNaN(date.getTime()) ? new Date() : date;
}

/**
 * פונקציה חכמה למציאת המשתמש הנכון
 * מנסה לפי סדר: מזהה ישן > אימייל > שם
 */
function resolveUser(oldId, oldEmail, oldName) {
    // 1. נסה לפי מזהה ישן
    if (oldId && userIdMap.has(oldId)) return userIdMap.get(oldId);
    
    // 2. נסה לפי אימייל (אם קיים בנתונים הישנים)
    if (oldEmail) {
        const cleanEmail = oldEmail.toLowerCase().trim();
        if (userEmailMap.has(cleanEmail)) return userEmailMap.get(cleanEmail);
    }

    // 3. נסה לפי שם (פחות בטוח, אבל עדיף מכלום)
    if (oldName) {
        const cleanName = oldName.trim();
        if (userNameMap.has(cleanName)) return userNameMap.get(cleanName);
    }

    return null;
}

/**
 * Parser מותאם אישית לקבצי ה-JSON הבעייתיים
 */
function parseStreamedJsonFileSync(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ הקובץ לא נמצא: ${filePath}`);
        return [];
    }

    console.log(`📖 קורא את ${path.basename(filePath)}...`);
    const fileBuffer = fs.readFileSync(filePath);
    const content = fileBuffer.toString('utf8');
    const objects = [];
    
    let braceCount = 0;
    let startIndex = -1;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"' && !isEscaped) inString = !inString;
        if (!isEscaped && char === '\\') isEscaped = true;
        else isEscaped = false;

        if (!inString) {
            if (char === '{') {
                if (braceCount === 0) startIndex = i;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && startIndex !== -1) {
                    const jsonStr = content.substring(startIndex, i + 1);
                    try {
                        objects.push(JSON.parse(jsonStr));
                    } catch (e) {}
                    startIndex = -1;
                }
            }
        }
    }
    console.log(`✅ חולצו ${objects.length} אובייקטים מ-${path.basename(filePath)}`);
    return objects;
}

// --- הלוגיקה הראשית ---

async function main() {
    try {
        console.log('🚀 מתחיל תהליך שחזור מלא ומתוקן...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ מחובר למסד הנתונים.');

        // שלב 0: ניקוי
        console.log('🧹 מנקה נתונים קיימים...');
        await Promise.all([
            User.deleteMany({}),
            Book.deleteMany({}),
            Page.deleteMany({}),
            Upload.deleteMany({}),
            Message.deleteMany({})
        ]);

        // שלב 1: טעינת files.json ומיפוי תוכן
        const filesData = parseStreamedJsonFileSync(FILES_JSON_PATH);
        let usersRawData = null;
        let uploadsMetaRawData = null;

        console.log('📝 בונה אינדקס תוכן...');
        filesData.forEach(item => {
            if (item.path === 'data/users.json') usersRawData = item.data;
            if (item.path === 'data/uploads-meta.json') uploadsMetaRawData = item.data;

            if (item.data && typeof item.data.content === 'string' && item.data.content.length > 0) {
                if (item.path.includes('data/content/') || item.path.includes('data/uploads/')) {
                    const normalized = normalizeKey(item.path);
                    contentMap.set(normalized, item.data.content);
                    if (normalized.includes('_')) {
                        contentMap.set(normalized.replace(/_/g, ' '), item.data.content);
                    }
                }
            }
        });

        // שלב 2: שחזור משתמשים (כולל בניית מפות חיפוש)
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
                    
                    // מילוי כל המפות לזיהוי עתידי
                    const newId = newUser._id;
                    userIdMap.set(u.id, newId);
                    userEmailMap.set(u.email.toLowerCase().trim(), newId);
                    if (u.name) userNameMap.set(u.name.trim(), newId);

                } catch (e) {}
            }
            console.log('✅ שחזור משתמשים הושלם.');
        }

        // שלב 3: שחזור Uploads
        if (uploadsMetaRawData && Array.isArray(uploadsMetaRawData)) {
            console.log(`📤 משחזר ${uploadsMetaRawData.length} העלאות...`);
            let contentFound = 0;

            for (const meta of uploadsMetaRawData) {
                if (!meta.bookName) continue;

                let content = '';
                const originalName = meta.fileName || meta.originalFileName || '';
                let searchKey = normalizeKey(originalName);
                
                if (contentMap.has(searchKey)) {
                    content = contentMap.get(searchKey);
                } else {
                    try {
                        const decodedKey = normalizeKey(decodeURIComponent(originalName));
                        if (contentMap.has(decodedKey)) content = contentMap.get(decodedKey);
                    } catch(e) {}
                }

                if (content) contentFound++;

                // שימוש ב-resolveUser כדי למצוא את המעלה
                const uploaderId = resolveUser(meta.uploadedById, null, meta.uploadedBy);

                await Upload.create({
                    uploader: uploaderId,
                    bookName: meta.bookName,
                    originalFileName: originalName,
                    content: content || '', 
                    status: meta.status || 'pending',
                    reviewedBy: resolveUser(meta.reviewedById, null, null),
                    createdAt: safeDate(meta.uploadedAt),
                    updatedAt: safeDate(meta.uploadedAt)
                });
            }
            console.log(`✅ שחזור Uploads הושלם (${contentFound} עם תוכן).`);
        }

        // שלב 4: שחזור ספרים ועמודים
        console.log('📚 טוען ומעבד את backups.json...');
        const backupsRaw = parseStreamedJsonFileSync(BACKUPS_JSON_PATH);
        const uniqueBooksMap = new Map();

        backupsRaw.forEach(item => {
            if (item.path && item.path.includes('data/pages/') && item.data) {
                const bookName = normalizeKey(item.path);
                uniqueBooksMap.set(bookName, item.data); // דריסה לטובת הגרסה האחרונה
            }
        });

        console.log(`📚 זוהו ${uniqueBooksMap.size} ספרים ייחודיים.`);

        for (const [bookName, pagesData] of uniqueBooksMap.entries()) {
            if (!Array.isArray(pagesData)) continue;

            const book = await Book.create({
                name: bookName,
                slug: createSlug(bookName),
                totalPages: pagesData.length,
                completedPages: 0, // יחושב בסוף
                category: 'כללי',
                folderPath: `/uploads/books/${createSlug(bookName)}`
            });

            const pagesToInsert = [];

            for (const p of pagesData) {
                const pageNum = extractValue(p.number);
                
                // שחזור תוכן
                let pageContent = p.content || '';
                if (!pageContent) {
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

                // *** התיקון הגדול לבעלות (Ownership) ***
                // מנסים למצוא את המשתמש בכל הדרכים האפשריות
                const claimedById = resolveUser(p.claimedById, null, p.claimedBy);
                
                // קביעת סטטוס - אם יש בעלים אך הסטטוס היה available, נשנה ל-in-progress
                let status = p.status || 'available';
                if (claimedById && status === 'available') {
                    status = 'in-progress';
                }

                pagesToInsert.push({
                    book: book._id,
                    pageNumber: pageNum,
                    content: pageContent,
                    status: status,
                    claimedBy: claimedById, // ה-ObjectId האמיתי מהמסד החדש
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

        // שלב 5: הודעות
        console.log('💬 משחזר הודעות...');
        const messagesData = parseStreamedJsonFileSync(MESSAGES_JSON_PATH);
        for (const msg of messagesData) {
            if (!msg.message && !msg.content) continue;

            const senderId = resolveUser(msg.senderId, null, msg.senderName);
            const recipientId = resolveUser(msg.recipientId, null, msg.recipientName);

            const replies = (msg.replies || []).map(r => ({
                sender: resolveUser(r.senderId, null, r.senderName),
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
        }

        // ==========================================
        // שלב 6: חישוב מחדש וסנכרון (Recalculation)
        // ==========================================
        console.log('🔄 מבצע חישוב מחדש של סטטיסטיקות ומונים...');

        // 6.1 עדכון מונים בספרים
        const books = await Book.find({});
        for (const book of books) {
            const completedCount = await Page.countDocuments({ book: book._id, status: 'completed' });
            const totalCount = await Page.countDocuments({ book: book._id });
            
            if (book.completedPages !== completedCount || book.totalPages !== totalCount) {
                await Book.findByIdAndUpdate(book._id, {
                    completedPages: completedCount,
                    totalPages: totalCount
                });
            }
        }
        console.log('✅ מוני ספרים עודכנו.');

        // 6.2 עדכון נקודות למשתמשים (אופציונלי אך מומלץ)
        // נניח שכל דף שווה 10 נקודות
        const users = await User.find({});
        for (const user of users) {
            // אם למשתמש יש כבר נקודות מהייבוא, נשאיר אותן, אלא אם כן נראה שיש פער גדול
            const completedByUser = await Page.countDocuments({ claimedBy: user._id, status: 'completed' });
            const calculatedPoints = completedByUser * 10;
            
            // אם הנקודות המחושבות גבוהות מהקיימות, נעדכן
            if (calculatedPoints > user.points) {
                await User.findByIdAndUpdate(user._id, { points: calculatedPoints });
            }
        }
        console.log('✅ ניקוד משתמשים סונכרן.');

        console.log('\n=====================================');
        console.log('🎉 מיגרציה מלאה הושלמה בהצלחה!');
        console.log('=====================================');
        
        process.exit(0);

    } catch (error) {
        console.error('\n❌ שגיאה קריטית:', error);
        process.exit(1);
    }
}

main();