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

// --- הגדרת סכמות ---
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

const UploadSchema = new mongoose.Schema({
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookName: { type: String, required: true },
    originalFileName: { type: String },
    content: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
const Upload = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);

// --- פונקציות עזר ---

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

function decodeFileName(encodedName) {
    try {
        const uriComponent = encodedName.replace(/_/g, '%');
        return decodeURIComponent(uriComponent);
    } catch (e) { return encodedName; }
}

// יצירת slug בטוח שתומך גם בעברית
function createSafeSlug(name, id) {
    // נסיון ראשון: אנגלית בלבד
    let slug = slugify(name, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    
    // אם ה-slug יצא ריק (כי השם בעברית), נשתמש במזהה ייחודי + השם המקורי מקודד
    if (!slug || slug.length < 2) {
        // מנקה תווים בעייתיים ל-URL אבל משאיר עברית
        const safeName = name.replace(/\s+/g, '-').replace(/[^\w\u0590-\u05FF-]/g, '');
        slug = `${safeName}-${id.toString().slice(-6)}`;
    }
    
    return slug;
}

const userMap = new Map(); 
const bookMap = new Map(); 

async function restore() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // קריאת הנתונים
        const rawFiles = await loadDataFromFile(FILES_JSON_PATH);
        const rawBackups = await loadDataFromFile(BACKUPS_JSON_PATH);
        const rawMessages = await loadDataFromFile(MESSAGES_JSON_PATH);
        const allMetadataSources = [...rawFiles, ...rawBackups];

        // ---------------------------------------------------------
        // שלב 1: משתמשים
        // ---------------------------------------------------------
        const usersEntry = rawFiles.find(f => f.path === 'data/users.json');
        if (usersEntry && usersEntry.data) {
            console.log(`Processing ${usersEntry.data.length} users...`);
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
        // שלב 2: ספרים (תיקון ה-Slug)
        // ---------------------------------------------------------
        const booksEntry = rawFiles.find(f => f.path === 'data/books.json');
        if (booksEntry && booksEntry.data) {
            console.log(`Processing ${booksEntry.data.length} books...`);
            for (const b of booksEntry.data) {
                const newId = new mongoose.Types.ObjectId();
                
                // שימוש בפונקציה המתוקנת ליצירת Slug
                const slug = createSafeSlug(b.name, newId);
                
                const existingBook = await Book.findOne({ name: b.name });
                const finalId = existingBook ? existingBook._id : newId;

                bookMap.set(b.name, { _id: finalId, slug });

                const totalPages = b.totalPages?.$numberInt ? parseInt(b.totalPages.$numberInt) : (b.totalPages || 0);

                await Book.updateOne(
                    { name: b.name },
                    {
                        $set: {
                            slug: slug, // התיקון כאן!
                            totalPages: totalPages,
                            folderPath: `/uploads/books/${slug}`,
                            createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
                        },
                        $setOnInsert: { _id: finalId, completedPages: 0 }
                    },
                    { upsert: true }
                );
            }
            console.log('✅ Books imported (with fixed slugs).');
        }

        // ---------------------------------------------------------
        // שלב 3: איחוי דפים
        // ---------------------------------------------------------
        console.log('🧩 Merging page metadata and content...');
        const pageOperations = [];
        const mergedPages = {};

        // א. מטא-דאטה
        allMetadataSources.filter(f => f.path && f.path.startsWith('data/pages/')).forEach(fileRecord => {
            const bookName = path.basename(fileRecord.path, '.json');
            if (!fileRecord.data || !Array.isArray(fileRecord.data)) return;
            if (!mergedPages[bookName]) mergedPages[bookName] = {};

            const bookInfo = bookMap.get(bookName);
            // אם הספר לא נמצא, ננסה לייצר slug ידני כדי לא לשבור את הקישור לתמונה
            const slugForThumb = bookInfo ? bookInfo.slug : slugify(bookName, {lower:true, strict:true}) || 'unknown';

            fileRecord.data.forEach(p => {
                const num = p.number?.$numberInt ? parseInt(p.number.$numberInt) : p.number;
                
                // כאן התיקון הקריטי לתמונות: קודם מהגיבוי, אחר כך מה-Slug
                const defaultThumb = `/uploads/books/${slugForThumb}/page.${num}.jpg`;
                
                mergedPages[bookName][num] = {
                    ...mergedPages[bookName][num],
                    status: p.status,
                    claimedById: p.claimedById,
                    claimedAt: p.claimedAt,
                    completedAt: p.completedAt,
                    thumbnail: p.thumbnail || defaultThumb // שמירה על הקישור המקורי
                };
            });
        });

        // ב. תוכן טקסט של דפים
        rawFiles.filter(f => f.path && f.path.startsWith('data/content/')).forEach(fileRecord => {
            const fileName = path.basename(fileRecord.path, '.txt');
            const decodedName = decodeFileName(fileName);
            const splitIndex = decodedName.lastIndexOf('_page_');
            
            if (splitIndex !== -1) {
                const bookNameRaw = decodedName.substring(0, splitIndex).trim();
                let validBookName = bookNameRaw;

                if (!bookMap.has(validBookName)) {
                    const spaceName = bookNameRaw.replace(/_/g, ' ');
                    if (bookMap.has(spaceName)) validBookName = spaceName;
                }

                const pageNumStr = decodedName.substring(splitIndex + 6);
                const pageNum = parseInt(pageNumStr);

                if (bookMap.has(validBookName)) {
                    if (!mergedPages[validBookName]) mergedPages[validBookName] = {};
                    if (!mergedPages[validBookName][pageNum]) {
                         const bookInfo = bookMap.get(validBookName);
                         const slug = bookInfo ? bookInfo.slug : 'unknown';
                         mergedPages[validBookName][pageNum] = { 
                            status: 'available',
                            thumbnail: `/uploads/books/${slug}/page.${pageNum}.jpg`
                        };
                    }
                    mergedPages[validBookName][pageNum].content = fileRecord.data?.content || '';
                }
            }
        });

        // ג. הכנסת דפים
        let totalPagesCount = 0;
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

                if (pageData.status === 'completed') {
                    bookCompletedCounts[bookInfo._id]++;
                }

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
                totalPagesCount++;
            }
        }

        if (pageOperations.length > 0) {
            console.log(`Inserting ${totalPagesCount} pages...`);
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
        // שלב 4: ייבוא Uploads (חדש! לתיקון ההורדות)
        // ---------------------------------------------------------
        // נחפש את מערך ה-uploads ב-files.json
        // זה עשוי להיות בתוך הרשומה הראשית או כרשומות נפרדות
        let uploadsData = [];
        
        // נסיון למצוא את מערך ה-uploads בתוך files.json
        const mainFileRecord = rawFiles.find(f => f.data && f.data.uploads && Array.isArray(f.data.uploads));
        
        if (mainFileRecord) {
             uploadsData = mainFileRecord.data.uploads;
        } else {
             // אם זה מפוצל, אולי נמצא רשומות שה-path שלהן הוא data/uploads.json
             const uploadsEntry = rawFiles.find(f => f.path === 'data/uploads.json');
             if (uploadsEntry && uploadsEntry.data) {
                 uploadsData = uploadsEntry.data;
             }
             // אם גם זה לא, ננסה לסרוק את כל הרשומות שהן העלאות (לפי מבנה)
             // אבל לפי הדוגמא שלך, זה נמצא בתוך אובייקט ראשי ב-files.json תחת מפתח "uploads"
             // אז נחפש את הרשומה שמכילה "uploads"
             rawFiles.forEach(f => {
                 if (f.uploads && Array.isArray(f.uploads)) { // פורמט אחד אפשרי
                     uploadsData = uploadsData.concat(f.uploads);
                 }
                 if (f.data && f.data.uploads && Array.isArray(f.data.uploads)) { // הפורמט שראינו בדוגמה
                     uploadsData = uploadsData.concat(f.data.uploads);
                 }
             });
        }

        if (uploadsData.length > 0) {
            console.log(`📂 Processing ${uploadsData.length} uploads...`);
            await Upload.deleteMany({}); // ניקוי העלאות קודמות

            const uploadsToInsert = uploadsData.map(u => {
                let uploaderId = null;
                let reviewerId = null;

                if (u.uploadedById && userMap.has(u.uploadedById)) {
                    uploaderId = userMap.get(u.uploadedById);
                } else {
                    // Fallback למשתמש ראשון/אדמין אם המקורי נמחק
                    uploaderId = userMap.values().next().value;
                }

                // המרת סטטוסים
                let status = 'pending';
                if (u.status === 'approved') status = 'approved';
                if (u.status === 'rejected') status = 'rejected';

                return {
                    uploader: uploaderId,
                    bookName: u.bookName || 'ספר ללא שם',
                    originalFileName: u.originalFileName || `upload-${Date.now()}.txt`,
                    content: u.content || "התוכן לא נמצא בקובץ הגיבוי. יש להעלות מחדש.", // טקסט ברירת מחדל כדי לא לשבור את הממשק
                    status: status,
                    reviewedBy: reviewerId,
                    createdAt: u.uploadedAt ? new Date(u.uploadedAt) : new Date(),
                    updatedAt: new Date()
                };
            });

            await Upload.insertMany(uploadsToInsert);
            console.log('✅ Uploads imported.');
        } else {
            console.log('⚠️ No uploads found in backup files.');
        }

        // ---------------------------------------------------------
        // שלב 5: הודעות
        // ---------------------------------------------------------
        if (rawMessages && rawMessages.length > 0) {
            console.log(`📨 Importing ${rawMessages.length} messages...`);
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
            if (messagesToInsert.length > 0) {
                await Message.deleteMany({});
                await Message.insertMany(messagesToInsert);
            }
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