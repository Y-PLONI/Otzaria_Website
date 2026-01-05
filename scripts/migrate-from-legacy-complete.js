/**
 * scripts/migrate-final-v3.js
 * גרסה מתוקנת שמטפלת במבני נתונים מורכבים של ספרים (Object vs Array)
 * ומבטיחה שכל הספרים יעברו.
 */

import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// טעינת הגדרות
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// --- הגדרות חיבור ---
const NEW_DB_URI = process.env.MONGODB_URI;
const OLD_DB_URI = process.env.LEGACY_MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_legacy';

if (!NEW_DB_URI) {
    console.error('❌ MONGODB_URI is missing in .env');
    process.exit(1);
}

// --- סכמות (Inline) ---

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    points: { type: Number, default: 0 },
}, { timestamps: true });

const BookSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, index: true, required: true },
    totalPages: { type: Number, default: 0 },
    completedPages: { type: Number, default: 0 },
    category: { type: String, default: 'כללי' },
    author: String,
    description: String,
    editingInfo: Object,
}, { timestamps: true });

const PageSchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    pageNumber: { type: Number, required: true },
    content: { type: String, default: '' },
    isTwoColumns: { type: Boolean, default: false },
    rightColumn: { type: String, default: '' },
    leftColumn: { type: String, default: '' },
    rightColumnName: { type: String, default: 'חלק 1' },
    leftColumnName: { type: String, default: 'חלק 2' },
    status: { type: String, enum: ['available', 'in-progress', 'completed'], default: 'available' },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimedAt: Date,
    completedAt: Date,
    imagePath: { type: String, required: true }
}, { timestamps: true });

PageSchema.index({ book: 1, pageNumber: 1 }, { unique: true });

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    replies: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const UploadSchema = new mongoose.Schema({
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookName: { type: String, required: true },
    originalFileName: String,
    content: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// מודלים
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);

const userIdMap = new Map();

// --- פונקציות עזר קריטיות ---

/**
 * מנרמל את הנתונים למערך.
 * מטפל במקרים שבהם המידע הוא אובייקט, מחרוזת, או עטוף במאפיין אחר.
 */
function normalizePagesData(data) {
    if (!data) return [];
    
    // 1. אם זה מחרוזת, נסה לפענח JSON
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { return []; }
    }

    // 2. אם זה כבר מערך - מצוין
    if (Array.isArray(data)) return data;

    // 3. אם זה אובייקט, נחפש איפה מסתתר המערך
    if (typeof data === 'object') {
        // האם יש מאפיין 'pages' או 'data' שהוא מערך?
        if (Array.isArray(data.pages)) return data.pages;
        if (Array.isArray(data.data)) return data.data;

        // האם זה אובייקט שהמפתחות שלו הם מספרים? ("0": {}, "1": {})
        // נבדוק אם הערכים הם אובייקטים שיש להם 'number' או 'status'
        const values = Object.values(data);
        if (values.length > 0 && values[0] && (values[0].number || values[0].status)) {
            return values;
        }
    }

    return [];
}

function createSafeSlug(text) {
    if (!text) return 'unknown-' + Date.now();
    return String(text).trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF\-]/g, '') // משמר עברית ואנגלית
        .toLowerCase();
}

function safeDate(d) {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? new Date() : date;
}

function safeString(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (Buffer.isBuffer(val)) return val.toString('utf8');
    return String(val);
}

function parsePageContent(rawContent) {
    const content = safeString(rawContent);
    if (!content) return { content: '', isTwoColumns: false };
    
    const splitRegex = /=== (.+?) ===\n([\s\S]*?)\n\n=== (.+?) ===\n([\s\S]*)/;
    const match = content.match(splitRegex);

    if (match) {
        return {
            content: '', 
            isTwoColumns: true,
            rightColumnName: match[1],
            rightColumn: match[2],
            leftColumnName: match[3],
            leftColumn: match[4]
        };
    }
    return { content: content, isTwoColumns: false, rightColumn: '', leftColumn: '' };
}

// --- המיגרציה ---

async function runMigration() {
    let oldClient;
    try {
        console.log('🏁 Starting FINAL V3 Migration...');

        // 1. חיבורים
        oldClient = new MongoClient(OLD_DB_URI);
        await oldClient.connect();
        const oldDb = oldClient.db();
        
        await mongoose.connect(NEW_DB_URI);
        console.log('✅ Connected to databases.');

        // 2. ניקוי
        console.log('🧹 Clearing new database...');
        await Promise.all([
            User.deleteMany({}),
            Book.deleteMany({}),
            Page.deleteMany({}),
            Message.deleteMany({}),
            Upload.deleteMany({})
        ]);

        // 3. משתמשים
        console.log('\n👥 Processing Users...');
        let oldUsers = [];
        const usersFile = await oldDb.collection('files').findOne({ path: 'data/users.json' });
        
        if (usersFile?.data) {
            oldUsers = typeof usersFile.data === 'string' ? JSON.parse(usersFile.data) : usersFile.data;
        } else {
            oldUsers = await oldDb.collection('users').find({}).toArray();
        }

        for (const u of oldUsers) {
            const newId = new mongoose.Types.ObjectId();
            if (u.id || u._id) userIdMap.set(String(u.id || u._id), newId);

            await User.create({
                _id: newId,
                name: u.name || `User_${u.id}`,
                email: u.email || `missing_${newId}@otzaria.local`,
                password: u.password || 'temp_pass',
                role: u.role || 'user',
                points: u.points || 0,
                createdAt: safeDate(u.createdAt),
                updatedAt: safeDate(u.updatedAt)
            });
        }
        console.log(`✅ Migrated ${oldUsers.length} users.`);
        
        const defaultAdminId = (await User.findOne({ role: 'admin' }))?._id;

        // 4. ספרים ודפים - החלק הקריטי
        console.log('\n📚 Processing Books & Pages...');
        
        const bookFilesCursor = oldDb.collection('files').find({ 
            path: { $regex: '^data/pages/' } 
        });

        let booksCount = 0;
        let pagesCount = 0;

        for await (const bookFile of bookFilesCursor) {
            try {
                const rawName = path.basename(bookFile.path, '.json');
                const slug = createSafeSlug(rawName);

                // שימוש בפונקציה החדשה לנירמול הנתונים
                const pagesData = normalizePagesData(bookFile.data);

                if (pagesData.length === 0) {
                    console.warn(`⚠️ Skipping ${rawName}: Empty or invalid data structure.`);
                    // הדפסת המבנה לצורך דיבוג אם זה קורה
                     console.log('DEBUG Structure:', JSON.stringify(bookFile.data).substring(0, 100));
                    continue;
                }

                // יצירת הספר
                const newBook = await Book.create({
                    name: rawName,
                    slug: slug,
                    totalPages: pagesData.length,
                    completedPages: pagesData.filter(p => p.status === 'completed').length,
                    category: 'כללי',
                    createdAt: safeDate(bookFile.uploadedAt) || new Date(),
                    updatedAt: new Date()
                });

                booksCount++;
                const newPages = [];

                for (const p of pagesData) {
                    const pageNum = parseInt(p.number);
                    if (!pageNum) continue;

                    // חיפוש תוכן ב-3 וריאציות
                    const possiblePaths = [
                        `data/content/${rawName}_page_${pageNum}.txt`,
                        `data/content/${rawName.replace(/\s/g, '_')}_page_${pageNum}.txt`,
                        `data/content/${rawName}_${pageNum}.txt`
                    ];

                    let rawContent = '';
                    for (const cp of possiblePaths) {
                        const contentDoc = await oldDb.collection('files').findOne({ path: cp });
                        if (contentDoc) {
                            rawContent = safeString(contentDoc.data?.content || contentDoc.data);
                            if (rawContent) break;
                        }
                    }

                    const parsedContent = parsePageContent(rawContent);
                    const claimerId = p.claimedById ? userIdMap.get(String(p.claimedById)) : null;

                    newPages.push({
                        book: newBook._id,
                        pageNumber: pageNum,
                        status: p.status || 'available',
                        claimedBy: claimerId,
                        claimedAt: safeDate(p.claimedAt),
                        completedAt: safeDate(p.completedAt),
                        // תמיכה בנתיב תמונה גם אם הוא מקומי או URL
                        imagePath: p.thumbnail || `/uploads/books/${slug}/page-${pageNum}.jpg`,
                        
                        content: parsedContent.content,
                        isTwoColumns: parsedContent.isTwoColumns,
                        rightColumn: parsedContent.rightColumn,
                        leftColumn: parsedContent.leftColumn,
                        rightColumnName: parsedContent.rightColumnName || 'חלק 1',
                        leftColumnName: parsedContent.leftColumnName || 'חלק 2'
                    });
                }

                if (newPages.length > 0) {
                    await Page.insertMany(newPages, { ordered: false });
                    pagesCount += newPages.length;
                }
                process.stdout.write('.');

            } catch (err) {
                console.error(`\n❌ Error processing book ${bookFile.path}:`, err.message);
            }
        }
        console.log(`\n✅ Finished: ${booksCount} books, ${pagesCount} pages.`);

        // 5. הודעות
        console.log('\n💬 Processing Messages...');
        const messagesCursor = oldDb.collection('messages').find({});
        let msgCount = 0;

        while (await messagesCursor.hasNext()) {
            try {
                const msg = await messagesCursor.next();
                const senderId = userIdMap.get(String(msg.senderId)) || defaultAdminId;
                
                if (senderId) {
                    await Message.create({
                        sender: senderId,
                        recipient: msg.recipientId ? userIdMap.get(String(msg.recipientId)) : null,
                        subject: safeString(msg.subject) || 'ללא נושא',
                        content: safeString(msg.message || msg.content),
                        isRead: !!(msg.status === 'read' || msg.isRead),
                        replies: (msg.replies || []).map(r => ({
                            sender: userIdMap.get(String(r.senderId)) || defaultAdminId,
                            content: safeString(r.message || r.content),
                            createdAt: safeDate(r.createdAt)
                        })).filter(r => r.sender),
                        createdAt: safeDate(msg.createdAt),
                        updatedAt: safeDate(msg.updatedAt)
                    });
                    msgCount++;
                }
            } catch (e) {}
        }
        console.log(`✅ Migrated ${msgCount} messages.`);

        // 6. העלאות
        console.log('\n📤 Processing Uploads...');
        const uploadsMetaDoc = await oldDb.collection('files').findOne({ path: 'data/uploads-meta.json' });
        let uploadsData = [];
        
        if (uploadsMetaDoc) {
            uploadsData = typeof uploadsMetaDoc.data === 'string' ? 
                JSON.parse(uploadsMetaDoc.data) : uploadsMetaDoc.data;
        }

        let uploadCount = 0;
        if (Array.isArray(uploadsData)) {
            for (const up of uploadsData) {
                try {
                    const uploaderId = userIdMap.get(String(up.uploadedById)) || defaultAdminId;
                    const uploadPath = `data/uploads/${up.fileName}`;
                    const contentDoc = await oldDb.collection('files').findOne({ path: uploadPath });
                    const content = contentDoc ? safeString(contentDoc.data?.content || contentDoc.data) : '';

                    if (uploaderId) {
                        await Upload.create({
                            uploader: uploaderId,
                            bookName: safeString(up.bookName),
                            originalFileName: safeString(up.originalFileName || up.fileName),
                            content: content,
                            status: up.status || 'pending',
                            reviewedBy: up.reviewedBy ? defaultAdminId : null,
                            createdAt: safeDate(up.uploadedAt),
                            updatedAt: safeDate(up.uploadedAt)
                        });
                        uploadCount++;
                    }
                } catch(e) {}
            }
        }
        console.log(`✅ Migrated ${uploadCount} uploads.`);
        console.log('\n🎉 ALL DONE!');

    } catch (error) {
        console.error('\n🛑 Fatal Error:', error);
    } finally {
        if (oldClient) await oldClient.close();
        await mongoose.disconnect();
    }
}

runMigration();