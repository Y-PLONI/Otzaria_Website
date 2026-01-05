import mongoose from 'mongoose';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// --- הגדרות ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FILES_JSON_PATH = path.resolve(__dirname, '../files.json');
const MESSAGES_JSON_PATH = path.resolve(__dirname, '../messages.json');
const BACKUPS_JSON_PATH = path.resolve(__dirname, '../backups.json');

// --- סכמות ---
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

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

// --- פונקציות עזר לניקוי נתונים ---

function decodeFileName(encodedName) {
    if (!encodedName) return '';
    try {
        const uriComponent = encodedName.replace(/_/g, '%');
        return decodeURIComponent(uriComponent);
    } catch (e) { return encodedName; }
}

function parseContentFilename(filename) {
    let decoded = filename;
    if (filename.startsWith('_')) {
        decoded = decodeFileName(filename);
    }
    const match = decoded.match(/(.*?)[\s_]+(?:page|daf|amud|p)[\s_]*(\d+)/i);
    if (match) {
        return {
            bookName: match[1].replace(/_/g, ' ').trim(),
            pageNumber: parseInt(match[2])
        };
    }
    return null;
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

function createHebrewSlug(name) {
    if (!name) return 'unknown-' + Date.now();
    return name.trim().replace(/\s+/g, '-').replace(/[^\w\u0590-\u05FF\-]/g, '');
}

// פונקציה קריטית: מנרמלת IDs להשוואה
function cleanId(id) {
    if (!id) return null;
    let strId = id;
    // טיפול באובייקטים של מונגו ישן
    if (typeof id === 'object') {
        if (id.$oid) strId = id.$oid;
        else if (id.id) strId = id.id;
        else strId = JSON.stringify(id);
    }
    return String(strId).trim();
}

async function loadDataFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File not found: ${filePath}`);
        return [];
    }
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent.trim().startsWith('[')) {
            return JSON.parse(fileContent);
        }
    } catch(e) {}

    const results = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const doc = JSON.parse(line);
            results.push(doc);
        } catch (err) {}
    }
    return results;
}

// --- משתנים גלובליים ---
const userMap = new Map(); // CleanID -> ObjectId
const userNameMap = new Map(); // Name -> ObjectId
const contentMap = new Map();

// --- Main Restore Function ---
async function restore() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // ניקוי
        console.log('🧹 Clearing DB...');
        await User.deleteMany({});
        await Book.deleteMany({});
        await Page.deleteMany({});
        await Message.deleteMany({});

        // 1. טעינת קבצים
        console.log('📖 Reading files...');
        const rawFiles = await loadDataFromFile(FILES_JSON_PATH);
        const rawBackups = await loadDataFromFile(BACKUPS_JSON_PATH);
        const rawMessages = await loadDataFromFile(MESSAGES_JSON_PATH);
        const allRecords = [...rawFiles, ...rawBackups];

        // 2. מיפוי תוכן
        console.log('📝 Indexing content...');
        rawFiles.forEach(f => {
            if (f.path && f.path.startsWith('data/content/') && f.data?.content) {
                const parsed = parseContentFilename(path.basename(f.path));
                if (parsed) {
                    contentMap.set(`${parsed.bookName}|${parsed.pageNumber}`, f.data.content);
                }
            }
        });

        // 3. שחזור משתמשים
        console.log('👥 Restoring Users...');
        const usersRecord = rawFiles.find(f => f.path === 'data/users.json');
        
        if (usersRecord && Array.isArray(usersRecord.data)) {
            for (const u of usersRecord.data) {
                const cleanedId = cleanId(u.id);
                const email = u.email ? u.email.toLowerCase().trim() : `user_${cleanedId}@temp.com`;
                const name = u.name ? u.name.trim() : 'Unknown';

                const userDoc = await User.create({
                    name,
                    email,
                    password: u.password,
                    role: u.role || 'user',
                    points: extractValue(u.points) || 0,
                    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                    updatedAt: new Date()
                });
                
                // מיפוי גם לפי ID וגם לפי שם
                if (cleanedId) userMap.set(cleanedId, userDoc._id);
                if (name) userNameMap.set(name, userDoc._id);
            }
            console.log(`✅ Restored ${userMap.size} users.`);
            
            // Debug: הדפס דוגמה למפתחות
            console.log('DEBUG: User Map Keys (Sample):', [...userMap.keys()].slice(0, 3));
        }

        // 4. מיזוג מידע על דפים (Files + Backups)
        console.log('📚 Processing pages data...');
        const pagesByBook = {};

        allRecords.forEach(record => {
            if (record.path && record.path.startsWith('data/pages/')) {
                let bookName = decodeFileName(path.basename(record.path, '.json'));
                if (!pagesByBook[bookName]) pagesByBook[bookName] = {};

                if (Array.isArray(record.data)) {
                    record.data.forEach(p => {
                        const pageNum = extractValue(p.number);
                        
                        // קבלת הקיים
                        const existing = pagesByBook[bookName][pageNum] || {};
                        
                        // מיזוג: קח את החדש, אבל שמור על שדות חשובים אם חסרים בחדש
                        const claimedById = p.claimedById || existing.claimedById;
                        const claimedBy = p.claimedBy || existing.claimedBy;
                        const status = p.status === 'available' && existing.status !== 'available' ? existing.status : p.status;
                        
                        pagesByBook[bookName][pageNum] = {
                            ...existing,
                            ...p,
                            claimedById,
                            claimedBy,
                            status
                        };
                    });
                }
            }
        });

        // 5. יצירת ספרים ודפים
        let totalPages = 0;
        let linkedPages = 0;
        let failLogCount = 0;

        for (const [bookName, pagesMap] of Object.entries(pagesByBook)) {
            const slug = createHebrewSlug(bookName);
            const book = await Book.create({
                name: bookName,
                slug,
                totalPages: Object.keys(pagesMap).length,
                completedPages: 0,
                category: 'כללי',
                folderPath: `/uploads/books/${slug}`
            });

            const pagesToInsert = [];
            let completedCount = 0;

            for (const [pageNumStr, pageData] of Object.entries(pagesMap)) {
                const pageNum = parseInt(pageNumStr);
                
                // --- לוגיקת שידוך משופרת ---
                let userId = null;
                const rawId = cleanId(pageData.claimedById);
                const rawName = pageData.claimedBy ? pageData.claimedBy.trim() : null;

                // נסיון 1: לפי ID
                if (rawId && userMap.has(rawId)) {
                    userId = userMap.get(rawId);
                } 
                // נסיון 2: לפי שם
                else if (rawName && userNameMap.has(rawName)) {
                    userId = userNameMap.get(rawName);
                }

                // לוג דיבוג לכישלונות (רק ל-10 הראשונים)
                if ((rawId || rawName) && !userId && failLogCount < 10) {
                    console.log(`⚠️ Failed to link page. Book: ${bookName}, Page: ${pageNum}`);
                    console.log(`   - ClaimedById (Raw): ${pageData.claimedById} -> Cleaned: ${rawId}`);
                    console.log(`   - ClaimedBy (Name): ${rawName}`);
                    failLogCount++;
                }

                if (userId) linkedPages++;
                if (pageData.status === 'completed') completedCount++;

                // טיפול בתמונה - שומרים מקור אם יש
                let imagePath = pageData.thumbnail;
                if (!imagePath || imagePath.length < 5) {
                    imagePath = `/uploads/books/${slug}/page.${pageNum}.jpg`;
                }

                pagesToInsert.push({
                    book: book._id,
                    pageNumber: pageNum,
                    content: contentMap.get(`${bookName}|${pageNum}`) || '',
                    status: pageData.status || 'available',
                    claimedBy: userId,
                    claimedAt: pageData.claimedAt ? new Date(extractValue(pageData.claimedAt)) : null,
                    completedAt: pageData.completedAt ? new Date(extractValue(pageData.completedAt)) : null,
                    imagePath: imagePath,
                    createdAt: pageData.createdAt ? new Date(extractValue(pageData.createdAt)) : new Date(),
                    updatedAt: pageData.updatedAt || new Date()
                });
            }

            if (pagesToInsert.length > 0) {
                await Page.insertMany(pagesToInsert);
                totalPages += pagesToInsert.length;
            }
            await Book.findByIdAndUpdate(book._id, { completedPages: completedCount });
            process.stdout.write('.');
        }

        console.log(`\n✅ Inserted ${totalPages} pages.`);
        console.log(`✅ Linked ${linkedPages} pages to users.`);

        // 6. שחזור הודעות
        console.log('📨 Restoring messages...');
        const messagesToInsert = [];
        
        if (rawMessages) {
            for (const msg of rawMessages) {
                const senderId = userMap.get(cleanId(msg.senderId));
                if (!senderId) continue;

                const replies = (msg.replies || []).map(r => ({
                    sender: userMap.get(cleanId(r.senderId)),
                    content: r.message,
                    createdAt: r.createdAt ? new Date(extractValue(r.createdAt)) : new Date()
                })).filter(r => r.sender);

                messagesToInsert.push({
                    sender: senderId,
                    recipient: null,
                    subject: msg.subject || 'ללא נושא',
                    content: msg.message,
                    isRead: !!msg.readAt,
                    replies,
                    createdAt: msg.createdAt ? new Date(extractValue(msg.createdAt)) : new Date()
                });
            }
            if (messagesToInsert.length > 0) await Message.insertMany(messagesToInsert);
        }
        console.log(`✅ Restored ${messagesToInsert.length} messages.`);

        // בדיקה סופית
        const check = await Page.countDocuments({ claimedBy: { $ne: null } });
        console.log(`\n🔎 Final DB Check: ${check} pages have an owner in MongoDB.`);

        console.log('🎉 DONE!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

restore();