/**
 * scripts/migrate-fixed.js
 * סקריפט מיגרציה מתוקן ומקצועי להעברת נתונים מלאה.
 * מטפל ביצירת Slugs תקינים, קישור משתמשים, והעברת תוכן מלאה.
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
// הנחה: יש לך מונגו מקומי שבו שחזרת את ה-BSON הישן לדאטהבייס בשם otzaria_legacy
const OLD_DB_URI = process.env.LEGACY_MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_legacy';

if (!NEW_DB_URI) {
    console.error('❌ MONGODB_URI is missing in .env');
    process.exit(1);
}

// --- הגדרת סכמות (בהתאמה מדויקת לקוד החדש) ---

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    points: { type: Number, default: 0 },
}, { timestamps: true });

const BookSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, index: true, required: true }, // חובה slug לניווט
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

// אינדקס למניעת כפילויות עמודים
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

// מפות עזר
const userIdMap = new Map();

// --- פונקציות עזר ---

// יצירת slug שמשמר עברית אבל מחליף רווחים ותווים בעייתיים
// זה קריטי לניתוב תקין ב-Next.js
function createSafeSlug(text) {
    if (!text) return 'unknown-' + Date.now();
    return text.trim()
        .replace(/\s+/g, '-')           // רווחים למקפים
        .replace(/[^\w\u0590-\u05FF\-]/g, '') // השארת עברית, אנגלית, מספרים ומקפים בלבד
        .toLowerCase();                 // (לאנגלית)
}

function safeDate(d) {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? new Date() : date;
}

// פירוק תוכן לדפים מפוצלים אם צריך
function parsePageContent(content) {
    if (!content) return { content: '', isTwoColumns: false };
    
    // זיהוי תבנית הפיצול מהמערכת הישנה
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
    
    return { 
        content: content, 
        isTwoColumns: false,
        rightColumn: '',
        leftColumn: ''
    };
}

// --- המיגרציה ---

async function runMigration() {
    let oldClient;
    try {
        console.log('🏁 Starting Full Migration...');

        // 1. חיבורים
        console.log('🔌 Connecting to databases...');
        oldClient = new MongoClient(OLD_DB_URI);
        await oldClient.connect();
        const oldDb = oldClient.db();
        
        await mongoose.connect(NEW_DB_URI);
        console.log('✅ Connected to both databases.');

        // 2. ניקוי
        console.log('🧹 Clearing new database...');
        await Promise.all([
            User.deleteMany({}),
            Book.deleteMany({}),
            Page.deleteMany({}),
            Message.deleteMany({}),
            Upload.deleteMany({})
        ]);
        console.log('✅ Database cleared.');

        // 3. משתמשים (Users)
        console.log('\n👥 processing Users...');
        // בודק גם ב-files (כמו שראינו קודם) וגם ב-collection 'users' אם קיים
        let oldUsers = [];
        
        // נסיון 1: קובץ users.json
        const usersFile = await oldDb.collection('files').findOne({ path: 'data/users.json' });
        if (usersFile?.data) oldUsers = usersFile.data;
        
        // נסיון 2: collection רגיל (אם לא מצא בקובץ)
        if (oldUsers.length === 0) {
            oldUsers = await oldDb.collection('users').find({}).toArray();
        }

        if (oldUsers.length === 0) console.warn('⚠️ No users found!');

        for (const u of oldUsers) {
            const newId = new mongoose.Types.ObjectId();
            // המרה בין ה-ID הישן (שיכול להיות string או מספר) ל-ObjectId החדש
            userIdMap.set(String(u.id || u._id), newId); 

            await User.create({
                _id: newId,
                name: u.name || 'Unknown',
                email: u.email || `missing_${newId}@otzaria.local`,
                password: u.password || 'temp_pass', // ישמור את ה-Hash המקורי אם קיים
                role: u.role || 'user',
                points: u.points || 0,
                createdAt: safeDate(u.createdAt),
                updatedAt: safeDate(u.updatedAt)
            });
        }
        console.log(`✅ Migrated ${oldUsers.length} users.`);
        
        // מציאת אדמין ברירת מחדל לשיוך יתומים
        const defaultAdmin = await User.findOne({ role: 'admin' }) || await User.findOne({});
        const defaultAdminId = defaultAdmin?._id;

        // 4. ספרים ודפים (Books & Pages)
        console.log('\n📚 Processing Books & Pages...');
        
        // נשלוף את כל הקבצים מ-collection 'files' שמתחילים ב-data/pages/
        // אלו קבצי ה-JSON שמגדירים את מבנה הספרים
        const bookFilesCursor = oldDb.collection('files').find({ 
            path: { $regex: '^data/pages/' } 
        });

        let booksCount = 0;
        let pagesCount = 0;

        for await (const bookFile of bookFilesCursor) {
            try {
                // חילוץ שם הספר מהנתיב: data/pages/BookName.json -> BookName
                const rawName = path.basename(bookFile.path, '.json');
                
                // יצירת slug נקי ותקין
                const slug = createSafeSlug(rawName);

                // נתוני העמודים (מערך)
                const pagesData = bookFile.data;
                if (!Array.isArray(pagesData)) {
                    console.warn(`⚠️ Skipping ${rawName}: Invalid data format`);
                    continue;
                }

                // בדיקה אם ספר כזה כבר קיים (למניעת כפילויות שם)
                const existingBook = await Book.findOne({ slug });
                if (existingBook) {
                    console.warn(`⚠️ Skipping duplicate book slug: ${slug} (${rawName})`);
                    continue;
                }

                // חישוב סטטיסטיקות
                const completedCount = pagesData.filter(p => p.status === 'completed').length;

                // יצירת הספר
                const newBook = await Book.create({
                    name: rawName,
                    slug: slug,
                    totalPages: pagesData.length,
                    completedPages: completedCount,
                    category: 'כללי', // ניתן לשפר אם יש מידע ב-files אחרים
                    createdAt: safeDate(bookFile.uploadedAt) || new Date(),
                    updatedAt: new Date()
                });

                booksCount++;
                const newPages = [];

                // מעבר על כל דף בספר
                for (const p of pagesData) {
                    const pageNum = parseInt(p.number);
                    if (!pageNum) continue;

                    // ניסיון לשלוף תוכן טקסט
                    // שם הקובץ ב-Content יכול להיות עם רווחים או קווים תחתונים
                    const possibleContentPaths = [
                        `data/content/${rawName}_page_${pageNum}.txt`,
                        `data/content/${rawName.replace(/\s/g, '_')}_page_${pageNum}.txt`,
                        `data/content/${rawName}_${pageNum}.txt`
                    ];

                    let rawContent = '';
                    
                    // חיפוש התוכן המתאים
                    for (const cp of possibleContentPaths) {
                        const contentDoc = await oldDb.collection('files').findOne({ path: cp });
                        if (contentDoc) {
                            rawContent = contentDoc.data?.content || contentDoc.data || '';
                            break;
                        }
                    }

                    // פרסור התוכן (חלוקה לטורים אם יש)
                    const parsedContent = parsePageContent(rawContent);

                    // שיוך משתמש
                    let claimerId = null;
                    if (p.claimedById) {
                        claimerId = userIdMap.get(String(p.claimedById));
                    }

                    newPages.push({
                        book: newBook._id,
                        pageNumber: pageNum,
                        status: p.status || 'available',
                        claimedBy: claimerId,
                        claimedAt: safeDate(p.claimedAt),
                        completedAt: safeDate(p.completedAt),
                        imagePath: p.thumbnail || `/uploads/books/${slug}/page-${pageNum}.jpg`, // נתיב גנרי או מה שהיה
                        
                        // התוכן
                        content: parsedContent.content,
                        isTwoColumns: parsedContent.isTwoColumns,
                        rightColumn: parsedContent.rightColumn,
                        leftColumn: parsedContent.leftColumn,
                        rightColumnName: parsedContent.rightColumnName || 'חלק 1',
                        leftColumnName: parsedContent.leftColumnName || 'חלק 2'
                    });
                }

                // שמירה בבת אחת (Batch Insert)
                if (newPages.length > 0) {
                    try {
                        await Page.insertMany(newPages);
                        pagesCount += newPages.length;
                    } catch (err) {
                        console.error(`❌ Error inserting pages for book ${rawName}:`, err.message);
                    }
                }
                
                process.stdout.write('.'); // התקדמות ויזואלית

            } catch (err) {
                console.error(`\n❌ Critical error processing book file ${bookFile.path}:`, err);
            }
        }
        console.log(`\n✅ Finished: ${booksCount} books, ${pagesCount} pages.`);


        // 5. הודעות (Messages)
        console.log('\n💬 Processing Messages...');
        // בדרך כלל הודעות נשמרו בקולקשיין messages ולא ב-files
        const messagesCursor = oldDb.collection('messages').find({});
        let msgCount = 0;

        while (await messagesCursor.hasNext()) {
            const msg = await messagesCursor.next();
            
            // המרה בטוחה של IDs
            const senderId = userIdMap.get(String(msg.senderId)) || defaultAdminId;
            const recipientId = msg.recipientId ? userIdMap.get(String(msg.recipientId)) : null;

            // עיבוד תגובות
            const replies = (msg.replies || []).map(r => ({
                sender: userIdMap.get(String(r.senderId)) || defaultAdminId,
                content: r.message || r.content,
                createdAt: safeDate(r.createdAt)
            })).filter(r => r.sender); // רק אם יש שולח תקין

            if (senderId) {
                await Message.create({
                    sender: senderId,
                    recipient: recipientId,
                    subject: msg.subject || 'ללא נושא',
                    content: msg.message || msg.content || '',
                    isRead: !!(msg.status === 'read' || msg.isRead),
                    replies: replies,
                    createdAt: safeDate(msg.createdAt),
                    updatedAt: safeDate(msg.updatedAt || msg.createdAt)
                });
                msgCount++;
            }
        }
        console.log(`✅ Migrated ${msgCount} messages.`);


        // 6. העלאות (Uploads)
        console.log('\n📤 Processing Uploads...');
        // מחפש את קובץ המטא-דאטה
        const uploadsMetaDoc = await oldDb.collection('files').findOne({ path: 'data/uploads-meta.json' });
        let uploadCount = 0;

        if (uploadsMetaDoc && Array.isArray(uploadsMetaDoc.data)) {
            for (const up of uploadsMetaDoc.data) {
                const uploaderId = userIdMap.get(String(up.uploadedById)) || defaultAdminId;
                
                // שליפת תוכן הקובץ
                const uploadFilePath = `data/uploads/${up.fileName}`;
                const fileContentDoc = await oldDb.collection('files').findOne({ path: uploadFilePath });
                const content = fileContentDoc ? 
                    (typeof fileContentDoc.data === 'string' ? fileContentDoc.data : fileContentDoc.data.content) 
                    : '';

                if (uploaderId) {
                    await Upload.create({
                        uploader: uploaderId,
                        bookName: up.bookName,
                        originalFileName: up.originalFileName || up.fileName,
                        content: content || '',
                        status: up.status || 'pending',
                        reviewedBy: up.reviewedBy ? defaultAdminId : null,
                        createdAt: safeDate(up.uploadedAt),
                        updatedAt: safeDate(up.uploadedAt)
                    });
                    uploadCount++;
                }
            }
        }
        console.log(`✅ Migrated ${uploadCount} uploads.`);

        console.log('\n🎉 ALL DONE! System is ready.');

    } catch (error) {
        console.error('\n🛑 Fatal Error:', error);
    } finally {
        if (oldClient) await oldClient.close();
        await mongoose.disconnect();
    }
}

runMigration();