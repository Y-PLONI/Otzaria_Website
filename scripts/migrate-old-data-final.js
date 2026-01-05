#!/usr/bin/env node

/**
 * סקריפט מיגרציה סופי להעברת נתונים מהמסד הישן לחדש
 * גרסה מעודכנת עם טיפול בכפילויות ואימות נתונים
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { readLargeJsonFile } = require('./safe-json-reader');

// ייבוא המודלים
const User = require('../src/models/User.js').default;
const Message = require('../src/models/Message.js').default;
const Book = require('../src/models/Book.js').default;
const Page = require('../src/models/Page.js').default;

// הגדרות
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_db';

// פונקציות עזר
function extractValue(val) {
    if (val && typeof val === 'object') {
        if (val.$numberInt) return parseInt(val.$numberInt);
        if (val.$oid) return val.$oid;
        if (val.$date && val.$date.$numberLong) return new Date(parseInt(val.$date.$numberLong));
        if (val.$date) return new Date(val.$date);
    }
    return val;
}

function createSlug(name) {
    if (!name) return 'unknown-' + Date.now();
    return name.trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF\-]/g, '')
        .toLowerCase();
}

// מיפוי משתמשים ישנים לחדשים
const userIdMapping = new Map();

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ התחברות למסד הנתונים הצליחה');
    } catch (error) {
        console.error('❌ שגיאה בהתחברות למסד הנתונים:', error);
        process.exit(1);
    }
}

async function clearDatabase() {
    console.log('🧹 מנקה מסד נתונים קיים...');
    await User.deleteMany({});
    await Message.deleteMany({});
    await Book.deleteMany({});
    await Page.deleteMany({});
    console.log('✅ מסד הנתונים נוקה');
}

async function migrateUsers() {
    console.log('\n👥 מתחיל מיגרציה של משתמשים...');
    
    const filesData = await readLargeJsonFile('files.json');
    
    // אם זה מערך של אובייקטים, נחפש את זה שמכיל משתמשים
    let usersData = null;
    if (Array.isArray(filesData)) {
        usersData = filesData.find(item => item.path === 'data/users.json');
    } else if (filesData.path === 'data/users.json') {
        usersData = filesData;
    }
    
    if (usersData && Array.isArray(usersData.data)) {
        const users = usersData.data;
        console.log(`📊 נמצאו ${users.length} משתמשים`);
        
        let migratedCount = 0;
        
        for (const oldUser of users) {
            try {
                const newUser = new User({
                    name: oldUser.name,
                    email: oldUser.email,
                    password: oldUser.password,
                    role: oldUser.role || 'user',
                    points: extractValue(oldUser.points) || 0,
                    createdAt: oldUser.createdAt ? new Date(oldUser.createdAt) : new Date(),
                    updatedAt: oldUser.passwordChangedAt ? new Date(oldUser.passwordChangedAt) : new Date()
                });
                
                const savedUser = await newUser.save();
                userIdMapping.set(oldUser.id, savedUser._id.toString());
                migratedCount++;
                
                if (migratedCount % 10 === 0) {
                    console.log(`✅ הועברו ${migratedCount} משתמשים`);
                }
            } catch (error) {
                console.error(`❌ שגיאה בהעברת משתמש ${oldUser.email}:`, error.message);
            }
        }
        
        console.log(`✅ הושלמה מיגרציה של ${migratedCount} משתמשים`);
    } else {
        console.log('❌ לא נמצאו נתוני משתמשים');
    }
}

async function migrateMessages() {
    console.log('\n💬 מתחיל מיגרציה של הודעות...');
    
    const messagesContent = fs.readFileSync('messages.json', 'utf8');
    
    // פיצול לאובייקטי JSON נפרדים (JSONL format)
    const messageObjects = [];
    let currentObject = '';
    let braceCount = 0;
    
    for (let i = 0; i < messagesContent.length; i++) {
        const char = messagesContent[i];
        currentObject += char;
        
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        
        if (braceCount === 0 && currentObject.trim()) {
            try {
                const messageObj = JSON.parse(currentObject.trim());
                messageObjects.push(messageObj);
                currentObject = '';
            } catch (e) {
                // המשך לתו הבא
            }
        }
    }
    
    console.log(`📊 נמצאו ${messageObjects.length} הודעות`);
    
    let migratedCount = 0;
    
    for (const oldMessage of messageObjects) {
        try {
            const senderId = userIdMapping.get(oldMessage.senderId);
            const recipientId = oldMessage.recipientId ? userIdMapping.get(oldMessage.recipientId) : null;
            
            if (!senderId) {
                console.log(`⚠️ לא נמצא משתמש שולח עבור הודעה: ${oldMessage.senderId}`);
                continue;
            }
            
            const newMessage = new Message({
                sender: senderId,
                recipient: recipientId,
                subject: oldMessage.subject,
                content: oldMessage.message,
                isRead: oldMessage.status === 'read',
                replies: (oldMessage.replies || []).map(reply => ({
                    sender: userIdMapping.get(reply.senderId),
                    content: reply.message,
                    createdAt: reply.createdAt ? new Date(reply.createdAt) : new Date()
                })).filter(reply => reply.sender), // רק תגובות עם שולח תקין
                createdAt: oldMessage.createdAt ? new Date(oldMessage.createdAt) : new Date(),
                updatedAt: oldMessage.updatedAt ? new Date(oldMessage.updatedAt) : new Date()
            });
            
            await newMessage.save();
            migratedCount++;
            
            if (migratedCount % 50 === 0) {
                console.log(`✅ הועברו ${migratedCount} הודעות`);
            }
        } catch (error) {
            console.error(`❌ שגיאה בהעברת הודעה:`, error.message);
        }
    }
    
    console.log(`✅ הושלמה מיגרציה של ${migratedCount} הודעות`);
}

async function migrateBooksAndPages() {
    console.log('\n📚 מתחיל מיגרציה של ספרים ועמודים...');
    
    const backupsContent = fs.readFileSync('backups.json', 'utf8');
    
    // פיצול לאובייקטי JSON נפרדים
    const bookObjects = [];
    let currentObject = '';
    let braceCount = 0;
    
    console.log('🔄 מפרק קובץ backups.json...');
    
    for (let i = 0; i < backupsContent.length; i++) {
        const char = backupsContent[i];
        currentObject += char;
        
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        
        if (braceCount === 0 && currentObject.trim()) {
            try {
                const bookObj = JSON.parse(currentObject.trim());
                if (bookObj.path && bookObj.path.includes('data/pages/') && bookObj.data) {
                    bookObjects.push(bookObj);
                }
                currentObject = '';
            } catch (e) {
                // המשך לתו הבא
            }
        }
        
        // הדפסת התקדמות
        if (i % 1000000 === 0) {
            console.log(`📊 עובד... ${((i / backupsContent.length) * 100).toFixed(1)}%`);
        }
    }
    
    console.log(`📊 נמצאו ${bookObjects.length} רשומות ספרים (כולל כפילויות)`);
    
    // מיזוג כפילויות - נבחר את הגרסה הטובה ביותר של כל ספר
    const bookVersions = new Map();
    
    bookObjects.forEach((bookData) => {
        const bookName = bookData.path.replace('data/pages/', '').replace('.json', '');
        
        if (!bookVersions.has(bookName)) {
            bookVersions.set(bookName, []);
        }
        
        bookVersions.get(bookName).push({
            data: bookData,
            totalPages: bookData.data.length,
            completedPages: bookData.data.filter(page => page.status === 'completed').length,
            inProgressPages: bookData.data.filter(page => page.status === 'in-progress').length
        });
    });
    
    console.log(`📚 נמצאו ${bookVersions.size} ספרים ייחודיים`);
    
    // בחירת הגרסה הטובה ביותר לכל ספר
    const bestVersions = [];
    bookVersions.forEach((versions, bookName) => {
        // מציאת הגרסה עם הכי הרבה עמודים גמורים
        const bestVersion = versions.reduce((best, current) => {
            // קודם לפי עמודים גמורים
            if (current.completedPages > best.completedPages) return current;
            if (current.completedPages < best.completedPages) return best;
            
            // אם שווים, לפי עמודים בעבודה
            if (current.inProgressPages > best.inProgressPages) return current;
            if (current.inProgressPages < best.inProgressPages) return best;
            
            // אם שווים, לפי סה"כ עמודים
            if (current.totalPages > best.totalPages) return current;
            return best;
        });
        
        bestVersions.push({
            bookName,
            ...bestVersion
        });
        
        if (versions.length > 1) {
            console.log(`🔄 ספר "${bookName}": נבחרה גרסה עם ${bestVersion.completedPages} עמודים גמורים מתוך ${versions.length} גרסאות`);
        }
    });
    
    console.log(`✅ נבחרו ${bestVersions.length} גרסאות טובות ביותר`);
    
    const bookIdMapping = new Map();
    let migratedBooks = 0;
    let migratedPages = 0;
    let totalCompletedPages = 0;
    let totalInProgressPages = 0;
    
    for (const bookVersion of bestVersions) {
        try {
            const bookName = bookVersion.bookName;
            const bookData = bookVersion.data.data;
            
            if (!bookName || !bookData) continue;
            
            // ספירת עמודים לפי סטטוס
            const completedCount = bookData.filter(page => page.status === 'completed').length;
            const inProgressCount = bookData.filter(page => page.status === 'in-progress').length;
            
            // יצירת הספר עם הספירות הנכונות
            const newBook = new Book({
                name: bookName,
                slug: createSlug(bookName),
                totalPages: bookData.length,
                completedPages: completedCount,
                category: 'כללי',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            const savedBook = await newBook.save();
            bookIdMapping.set(bookName, savedBook._id.toString());
            migratedBooks++;
            
            console.log(`📖 נוצר ספר: ${bookName} (${bookData.length} עמודים, ${completedCount} גמורים, ${inProgressCount} בעבודה)`);
            
            // יצירת העמודים
            const pages = [];
            for (const pageData of bookData) {
                const claimedBy = pageData.claimedById ? userIdMapping.get(pageData.claimedById) : null;
                
                const newPage = {
                    book: savedBook._id,
                    pageNumber: extractValue(pageData.number),
                    content: '', // יתמלא מאוחר יותר
                    status: pageData.status === 'completed' ? 'completed' : 
                           pageData.status === 'in-progress' ? 'in-progress' : 'available',
                    claimedBy: claimedBy,
                    claimedAt: pageData.claimedAt ? new Date(pageData.claimedAt) : null,
                    completedAt: pageData.completedAt ? new Date(pageData.completedAt) : null,
                    imagePath: pageData.thumbnail || `/uploads/books/${createSlug(bookName)}/page-${extractValue(pageData.number)}.jpg`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                pages.push(newPage);
            }
            
            // הכנסה בקבוצות לביצועים טובים יותר
            const batchSize = 100;
            for (let i = 0; i < pages.length; i += batchSize) {
                const batch = pages.slice(i, i + batchSize);
                await Page.insertMany(batch);
                migratedPages += batch.length;
            }
            
            // עדכון ספירות הספר לפי הנתונים בפועל
            const actualCompletedCount = pages.filter(page => page.status === 'completed').length;
            const actualInProgressCount = pages.filter(page => page.status === 'in-progress').length;
            
            await Book.findByIdAndUpdate(savedBook._id, {
                completedPages: actualCompletedCount,
                totalPages: pages.length
            });
            
            totalCompletedPages += actualCompletedCount;
            totalInProgressPages += actualInProgressCount;
            
            console.log(`✅ ספר "${bookName}": ${pages.length} עמודים (${actualCompletedCount} גמורים, ${actualInProgressCount} בעבודה)`);
            
            if (migratedBooks % 5 === 0) {
                console.log(`✅ הועברו ${migratedBooks} ספרים עד כה...`);
            }
            
        } catch (error) {
            console.error(`❌ שגיאה בהעברת ספר ${bookVersion.bookName}:`, error.message);
        }
    }
    
    console.log(`✅ הושלמה מיגרציה של ${migratedBooks} ספרים ו-${migratedPages} עמודים`);
    console.log(`📊 סיכום: ${totalCompletedPages} עמודים גמורים, ${totalInProgressPages} עמודים בעבודה`);
}

async function validateMigration() {
    console.log('\n🔍 מאמת מיגרציה...');
    
    const userCount = await User.countDocuments();
    const messageCount = await Message.countDocuments();
    const bookCount = await Book.countDocuments();
    const pageCount = await Page.countDocuments();
    
    console.log(`📊 סיכום מיגרציה:`);
    console.log(`   👥 משתמשים: ${userCount}`);
    console.log(`   💬 הודעות: ${messageCount}`);
    console.log(`   📚 ספרים: ${bookCount}`);
    console.log(`   📄 עמודים: ${pageCount}`);
    
    // בדיקות נוספות
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const completedPages = await Page.countDocuments({ status: 'completed' });
    const inProgressPages = await Page.countDocuments({ status: 'in-progress' });
    const availablePages = await Page.countDocuments({ status: 'available' });
    const messagesWithReplies = await Message.countDocuments({ 'replies.0': { $exists: true } });
    
    console.log(`\n📈 סטטיסטיקות נוספות:`);
    console.log(`   👑 מנהלים: ${adminUsers}`);
    console.log(`   ✅ עמודים גמורים: ${completedPages}`);
    console.log(`   🔄 עמודים בעבודה: ${inProgressPages}`);
    console.log(`   ⏳ עמודים זמינים: ${availablePages}`);
    console.log(`   💬 הודעות עם תגובות: ${messagesWithReplies}`);
    
    // בדיקת עקביות ספירות בספרים
    console.log(`\n🔍 בדיקת עקביות ספירות:`);
    const books = await Book.find();
    let inconsistentBooks = 0;
    
    for (const book of books) {
        const actualCompleted = await Page.countDocuments({ book: book._id, status: 'completed' });
        const actualTotal = await Page.countDocuments({ book: book._id });
        
        if (actualCompleted !== book.completedPages || actualTotal !== book.totalPages) {
            console.log(`⚠️ אי-עקביות בספר "${book.name}": רשום ${book.completedPages}/${book.totalPages}, בפועל ${actualCompleted}/${actualTotal}`);
            inconsistentBooks++;
            
            // תיקון אוטומטי
            await Book.findByIdAndUpdate(book._id, {
                completedPages: actualCompleted,
                totalPages: actualTotal
            });
            console.log(`✅ תוקן ספר "${book.name}"`);
        }
    }
    
    if (inconsistentBooks === 0) {
        console.log(`✅ כל הספירות עקביות`);
    } else {
        console.log(`🔧 תוקנו ${inconsistentBooks} ספרים`);
    }
}

async function main() {
    console.log('🚀 מתחיל מיגרציה של נתונים ישנים...\n');
    
    try {
        await connectDB();
        
        // אזהרה למשתמש
        console.log('⚠️  אזהרה: פעולה זו תמחק את כל הנתונים הקיימים במסד!');
        console.log('⚠️  לחץ Ctrl+C כדי לבטל, או המתן 5 שניות להמשך...\n');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await clearDatabase();
        await migrateUsers();
        await migrateMessages();
        await migrateBooksAndPages();
        await validateMigration();
        
        console.log('\n🎉 מיגרציה הושלמה בהצלחה!');
        
    } catch (error) {
        console.error('❌ שגיאה במיגרציה:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 התנתקות מהמסד');
    }
}

// הרצה רק אם זה הקובץ הראשי
if (require.main === module) {
    main();
}

module.exports = { main };