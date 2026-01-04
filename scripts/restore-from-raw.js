import mongoose from 'mongoose';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import dotenv from 'dotenv';
import slugify from 'slugify';
import { fileURLToPath } from 'url';

// 1. טעינת משתני סביבה
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const FILES_JSON_PATH = 'files.json';
const MESSAGES_JSON_PATH = 'messages.json';
const BACKUPS_JSON_PATH = 'backups.json';

// --- סכמות (העתק מדויק מהפרויקט החדש) ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    points: { type: Number, default: 0 },
}, { timestamps: true });

const BookSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, index: true },
    totalPages: { type: Number, default: 0 },
    completedPages: { type: Number, default: 0 },
    category: { type: String, default: 'כללי' },
    folderPath: { type: String },
}, { timestamps: true });

const PageSchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    pageNumber: { type: Number, required: true },
    content: { type: String, default: '' },
    status: { type: String, enum: ['available', 'in-progress', 'completed'], default: 'available' },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimedAt: { type: Date },
    completedAt: { type: Date },
    imagePath: { type: String, required: true },
}, { timestamps: true });

const UploadSchema = new mongoose.Schema({
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookName: { type: String, required: true },
    originalFileName: { type: String },
    content: { type: String }, // <--- זה השדה הקריטי להורדה!
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    subject: { type: String, default: 'ללא נושא' },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    replies: [{
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      content: String,
      createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// --- פונקציות עזר לניקוי וזיהוי שמות ---

// מפענח שמות מקודדים (URI Component)
function decodeFileName(encodedName) {
    try {
        const uriComponent = encodedName.replace(/_/g, '%');
        return decodeURIComponent(uriComponent);
    } catch (e) { return encodedName; }
}

// יוצר "מפתח נקי" להשוואה בין שמות קבצים
// מסיר סיומות, מספרים אקראיים, רווחים וכו' כדי למצוא התאמה
function normalizeKey(filename) {
    if (!filename) return '';
    let name = filename;
    
    // אם השם מקודד (מתחיל ב-_D7...), נפענח אותו קודם
    if (name.startsWith('_')) {
        name = decodeFileName(name);
    }

    return name
        .replace(/\.txt$/i, '')           // הסרת סיומת
        .replace(/_\d{10,}/, '')          // הסרת timestamp ארוך בסוף (למשל _1767489134475)
        .replace(/[-_\s]+/g, ' ')         // החלפת מפרידים ברווח
        .trim()
        .toLowerCase();
}

// יצירת slug שמשמר עברית
function createHebrewSlug(name) {
    if (!name) return 'unknown';
    return name.trim().replace(/\s+/g, '-').replace(/[^\w\u0590-\u05FF\-]/g, '');
}

async function loadDataFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File not found: ${filePath}`);
        return [];
    }

    const results = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    console.log(`📖 Streaming ${filePath}...`);

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const doc = JSON.parse(line);
            results.push(doc);
        } catch (err) {}
    }

    if (results.length === 0) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            if (Array.isArray(data)) return data;
            return [data];
        } catch (e) {}
    }
    return results;
}

// מפות גלובליות
const userMap = new Map(); 
const bookMap = new Map(); 
const contentMap = new Map(); // NormalizedKey -> Content

async function restore() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // קריאת כל הקבצים
        const rawFiles = await loadDataFromFile(FILES_JSON_PATH);
        const rawBackups = await loadDataFromFile(BACKUPS_JSON_PATH);
        const rawMessages = await loadDataFromFile(MESSAGES_JSON_PATH);
        const allMetadataSources = [...rawFiles, ...rawBackups];

        // ---------------------------------------------------------
        // שלב 0: בניית אינדקס תוכן חכם
        // ---------------------------------------------------------
        console.log('📝 Building content index...');
        rawFiles.filter(f => f.path && f.path.startsWith('data/content/')).forEach(fileRecord => {
            if (fileRecord.data && fileRecord.data.content) {
                const rawName = path.basename(fileRecord.path); 
                const normalized = normalizeKey(rawName);
                
                // שמירה במפה לפי המפתח המנורמל
                // אם יש כפילויות, האחרון דורס (בדרך כלל זה בסדר)
                contentMap.set(normalized, fileRecord.data.content);
                
                // שמירה גם לפי השם המקורי ליתר ביטחון
                contentMap.set(rawName, fileRecord.data.content);
            }
        });
        console.log(`✅ Indexed ${contentMap.size} text contents.`);

        // ---------------------------------------------------------
        // שלב 1: משתמשים
        // ---------------------------------------------------------
        const usersEntry = rawFiles.find(f => f.path === 'data/users.json');
        if (usersEntry && usersEntry.data) {
            console.log(`Processing users...`);
            for (const u of usersEntry.data) {
                const newId = new mongoose.Types.ObjectId();
                const existingUser = await User.findOne({ email: u.email });
                const finalId = existingUser ? existingUser._id : newId;
                
                userMap.set(u.id, finalId);
                const points = u.points?.$numberInt ? parseInt(u.points.$numberInt) : (u.points || 0);

                await User.updateOne(
                    { email: u.email },
                    {
                        $set: {
                            name: u.name,
                            password: u.password,
                            role: u.role,
                            points: points,
                            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                        },
                        $setOnInsert: { _id: finalId }
                    },
                    { upsert: true }
                );
            }
            console.log('✅ Users imported.');
        }

        // ---------------------------------------------------------
        // שלב 2: ספרים
        // ---------------------------------------------------------
        const booksEntry = rawFiles.find(f => f.path === 'data/books.json');
        if (booksEntry && booksEntry.data) {
            console.log(`Processing books...`);
            for (const b of booksEntry.data) {
                const newId = new mongoose.Types.ObjectId();
                const slug = createHebrewSlug(b.name);
                
                const existingBook = await Book.findOne({ name: b.name });
                const finalId = existingBook ? existingBook._id : newId;

                bookMap.set(b.name, { _id: finalId, slug });
                const totalPages = b.totalPages?.$numberInt ? parseInt(b.totalPages.$numberInt) : (b.totalPages || 0);

                await Book.updateOne(
                    { name: b.name },
                    {
                        $set: {
                            slug: slug,
                            totalPages: totalPages,
                            folderPath: `/uploads/books/${slug}`,
                            createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
                        },
                        $setOnInsert: { _id: finalId, completedPages: 0 }
                    },
                    { upsert: true }
                );
            }
            console.log('✅ Books imported.');
        }

        // ---------------------------------------------------------
        // שלב 3: Uploads (קבצי טקסט להורדה)
        // ---------------------------------------------------------
        // איתור רשימת ההעלאות
        let uploadsData = [];
        rawFiles.forEach(f => {
            if (f.data && f.data.uploads && Array.isArray(f.data.uploads)) {
                uploadsData = uploadsData.concat(f.data.uploads);
            }
        });

        if (uploadsData.length > 0) {
            console.log(`📂 Processing ${uploadsData.length} uploads...`);
            await Upload.deleteMany({}); 

            let mappedCount = 0;
            const uploadsToInsert = uploadsData.map(u => {
                let uploaderId = null;
                if (u.uploadedById && userMap.has(u.uploadedById)) {
                    uploaderId = userMap.get(u.uploadedById);
                } else {
                    uploaderId = userMap.values().next().value;
                }

                // --- חיפוש תוכן "עקשן" ---
                let realContent = '';
                const keysToTry = [
                    normalizeKey(u.fileName),           // לפי שם הקובץ שנוצר (למשל עם timestamp)
                    normalizeKey(u.originalFileName),   // לפי השם המקורי
                    u.fileName,                         // לפי השם המדויק
                    u.bookName                          // לפי שם הספר (לפעמים זה אותו דבר)
                ];

                for (const key of keysToTry) {
                    if (key && contentMap.has(key)) {
                        realContent = contentMap.get(key);
                        mappedCount++;
                        break;
                    }
                }

                if (!realContent) {
                    // נסיון אחרון: חיפוש חלקי במפה
                    // זה איטי יותר, אבל מציל נתונים במקרים קשים
                    for (const [mapKey, mapContent] of contentMap.entries()) {
                         if (mapKey.includes(normalizeKey(u.bookName)) || normalizeKey(u.fileName).includes(mapKey)) {
                             realContent = mapContent;
                             mappedCount++;
                             break;
                         }
                    }
                }

                const finalContent = realContent || "שגיאה: התוכן לא נמצא בקובץ הגיבוי.";

                return {
                    uploader: uploaderId,
                    bookName: u.bookName || 'ספר ללא שם',
                    originalFileName: u.originalFileName || `upload.txt`,
                    content: finalContent, // כאן נשמר הטקסט שיוצג בהורדה!
                    status: u.status === 'approved' ? 'approved' : u.status === 'rejected' ? 'rejected' : 'pending',
                    reviewedBy: null,
                    createdAt: u.uploadedAt ? new Date(u.uploadedAt) : new Date(),
                    updatedAt: new Date()
                };
            });

            await Upload.insertMany(uploadsToInsert);
            console.log(`✅ Uploads imported. Successfully matched content for ${mappedCount}/${uploadsToInsert.length} files.`);
        }

        // ---------------------------------------------------------
        // שלב 4: דפים (Pages)
        // ---------------------------------------------------------
        console.log('🧩 Processing pages...');
        const mergedPages = {};

        // איסוף מטא-דאטה
        allMetadataSources.filter(f => f.path && f.path.startsWith('data/pages/')).forEach(fileRecord => {
            const bookName = path.basename(fileRecord.path, '.json');
            if (!fileRecord.data || !Array.isArray(fileRecord.data)) return;
            if (!mergedPages[bookName]) mergedPages[bookName] = {};

            const bookInfo = bookMap.get(bookName);
            const slugForThumb = bookInfo ? bookInfo.slug : createHebrewSlug(bookName);

            fileRecord.data.forEach(p => {
                const num = p.number?.$numberInt ? parseInt(p.number.$numberInt) : p.number;
                const defaultThumb = `/uploads/books/${slugForThumb}/page.${num}.jpg`;
                
                // גם כאן נשתמש במיפוי התוכן החכם
                const contentKey = normalizeKey(`${bookName} page ${num}`);
                const content = contentMap.get(contentKey) || '';

                mergedPages[bookName][num] = {
                    ...mergedPages[bookName][num],
                    status: p.status,
                    claimedById: p.claimedById,
                    claimedAt: p.claimedAt,
                    completedAt: p.completedAt,
                    thumbnail: p.thumbnail || defaultThumb,
                    content: content
                };
            });
        });

        // יצירה והכנסה
        const pageOperations = [];
        const bookCompletedCounts = {};

        for (const [bookName, pagesObj] of Object.entries(mergedPages)) {
            const bookInfo = bookMap.get(bookName);
            if (!bookInfo) continue;
            bookCompletedCounts[bookInfo._id] = 0;

            for (const [pageNumStr, pageData] of Object.entries(pagesObj)) {
                let claimedByNewId = null;
                if (pageData.claimedById && userMap.has(pageData.claimedById)) {
                    claimedByNewId = userMap.get(pageData.claimedById);
                } else if (pageData.claimedById) {
                     claimedByNewId = userMap.values().next().value; 
                }

                if (pageData.status === 'completed') bookCompletedCounts[bookInfo._id]++;

                pageOperations.push({
                    book: bookInfo._id,
                    pageNumber: parseInt(pageNumStr),
                    content: pageData.content || '',
                    status: pageData.status || 'available',
                    claimedBy: claimedByNewId,
                    claimedAt: pageData.claimedAt ? new Date(pageData.claimedAt) : null,
                    completedAt: pageData.completedAt ? new Date(pageData.completedAt) : null,
                    imagePath: pageData.thumbnail
                });
            }
        }

        if (pageOperations.length > 0) {
            console.log(`Inserting ${pageOperations.length} pages...`);
            await Page.deleteMany({});
            const chunkSize = 500;
            for (let i = 0; i < pageOperations.length; i += chunkSize) {
                await Page.insertMany(pageOperations.slice(i, i + chunkSize));
                process.stdout.write('.');
            }
            console.log('\n✅ Pages imported.');
        }

        for (const [bookId, count] of Object.entries(bookCompletedCounts)) {
            await Book.findByIdAndUpdate(bookId, { completedPages: count });
        }

        // ---------------------------------------------------------
        // שלב 5: הודעות
        // ---------------------------------------------------------
        if (rawMessages && rawMessages.length > 0) {
            console.log(`📨 Importing messages...`);
            const messagesToInsert = [];
            for (const msg of rawMessages) {
                const senderId = userMap.get(msg.senderId);
                const replies = (msg.replies || []).map(r => ({
                    sender: userMap.get(r.senderId),
                    content: r.message,
                    createdAt: r.createdAt ? new Date(r.createdAt) : new Date()
                })).filter(r => r.sender);

                if (senderId) {
                    messagesToInsert.push({
                        sender: senderId,
                        subject: msg.subject || 'ללא נושא',
                        content: msg.message,
                        isRead: !!msg.readAt,
                        replies: replies,
                        createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date()
                    });
                }
            }
            await Message.deleteMany({});
            await Message.insertMany(messagesToInsert);
            console.log('✅ Messages imported.');
        }

        console.log('🎉 RESTORE COMPLETE!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during restore:', error);
        process.exit(1);
    }
}

restore();