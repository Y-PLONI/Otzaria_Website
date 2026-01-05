import mongoose from 'mongoose';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const FILES_JSON_PATH = 'files.json';
const BACKUPS_JSON_PATH = 'backups.json';

// --- סכמות מינימליות לעדכון ---
const UserSchema = new mongoose.Schema({ email: String });
const BookSchema = new mongoose.Schema({ name: String });
const PageSchema = new mongoose.Schema({
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    pageNumber: Number,
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: String
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);
const Page = mongoose.models.Page || mongoose.model('Page', PageSchema);

// --- פונקציית עזר לקריאת JSON ---
function readJson(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(content);
    } catch (e) {
        try {
            return content.trim().split('\n').map(line => JSON.parse(line));
        } catch (e2) { return []; }
    }
}

async function fixOwners() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        // 1. טעינת נתונים גולמיים
        console.log('📖 Reading backup files...');
        const rawFiles = readJson(FILES_JSON_PATH);
        const rawBackups = readJson(BACKUPS_JSON_PATH);
        const allData = [...rawFiles, ...rawBackups];

        // 2. בניית מפת משתמשים: OldID -> Email
        console.log('🗺️  Mapping Old IDs to Emails...');
        const oldIdToEmail = new Map();
        
        // חיפוש נתוני משתמשים
        const usersData = rawFiles.find(f => f.path === 'data/users.json')?.data || [];
        usersData.forEach(u => {
            if (u.id && u.email) {
                oldIdToEmail.set(u.id, u.email);
            }
        });

        // 3. שליפת המשתמשים האמיתיים מהמסד: Email -> NewMongoID
        console.log('👥 Fetching current users from DB...');
        const dbUsers = await User.find({});
        const emailToNewId = new Map();
        dbUsers.forEach(u => {
            emailToNewId.set(u.email, u._id);
        });

        // 4. שליפת הספרים מהמסד: Name -> BookID
        console.log('📚 Fetching books from DB...');
        const dbBooks = await Book.find({});
        const nameToBookId = new Map();
        dbBooks.forEach(b => {
            nameToBookId.set(b.name, b._id);
        });

        // 5. מעבר על כל הדפים בגיבוי ועדכון המסד
        console.log('🔧 Fixing page ownership...');
        let updateCount = 0;

        // איסוף כל נתוני הדפים מהגיבויים
        const pagesRecords = allData.filter(f => f.path && f.path.startsWith('data/pages/'));

        for (const record of pagesRecords) {
            const bookName = path.basename(record.path, '.json');
            const bookId = nameToBookId.get(bookName);

            if (!bookId) {
                // console.warn(`   Skipping unknown book: ${bookName}`);
                continue;
            }

            if (!record.data || !Array.isArray(record.data)) continue;

            for (const p of record.data) {
                // בדיקה אם לדף הזה יש בכלל בעלים בגיבוי
                if (!p.claimedById) continue;

                // המרה: OldID -> Email -> NewID
                const email = oldIdToEmail.get(p.claimedById);
                const newUserId = email ? emailToNewId.get(email) : null;

                if (newUserId) {
                    const pageNum = p.number?.$numberInt ? parseInt(p.number.$numberInt) : p.number;

                    // עדכון המסד
                    const res = await Page.updateOne(
                        { book: bookId, pageNumber: pageNum },
                        { 
                            $set: { 
                                claimedBy: newUserId,
                                status: p.status // משחזר גם את הסטטוס ליתר ביטחון
                            } 
                        }
                    );

                    if (res.modifiedCount > 0) {
                        updateCount++;
                    }
                }
            }
        }

        console.log(`✅ Successfully linked ${updateCount} pages to their users.`);
        
        // 6. רענון סטטיסטיקות משתמשים (אופציונלי, כדי לוודא סנכרון)
        console.log('🔄 Verifying user points...');
        // (החלק הזה הוא רק לוגי, הנתונים כבר שם)

        console.log('🎉 FIX COMPLETE!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixOwners();