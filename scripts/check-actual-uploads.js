#!/usr/bin/env node

const mongoose = require('mongoose');

// הגדרות
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otzaria_db';

// הגדרת סכמה זמנית
const UploadSchema = new mongoose.Schema({
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookName: { type: String, required: true },
  originalFileName: { type: String },
  content: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Upload = mongoose.model('Upload', UploadSchema);

async function checkActualUploads() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ התחברות למסד הנתונים הצליחה');
        
        const totalUploads = await Upload.countDocuments();
        console.log(`📊 סה"כ uploads במסד: ${totalUploads}`);
        
        const uploadsWithContent = await Upload.countDocuments({ content: { $exists: true, $ne: '', $ne: null } });
        console.log(`📄 uploads עם תוכן: ${uploadsWithContent}`);
        
        const uploadsWithoutContent = await Upload.countDocuments({ $or: [{ content: { $exists: false } }, { content: '' }, { content: null }] });
        console.log(`❌ uploads ללא תוכן: ${uploadsWithoutContent}`);
        
        // דוגמאות
        console.log('\n🔍 דוגמאות של uploads:');
        const samples = await Upload.find().limit(5);
        
        samples.forEach((upload, index) => {
            console.log(`\nUpload ${index + 1}:`);
            console.log(`  ID: ${upload._id}`);
            console.log(`  ספר: ${upload.bookName}`);
            console.log(`  שם קובץ: ${upload.originalFileName}`);
            console.log(`  יש תוכן: ${upload.content ? 'כן' : 'לא'}`);
            if (upload.content) {
                console.log(`  אורך תוכן: ${upload.content.length} תווים`);
                console.log(`  תחילת תוכן: "${upload.content.substring(0, 100)}..."`);
            } else {
                console.log(`  תוכן: ${upload.content}`);
            }
        });
        
        // בדיקה ספציפית של upload עם תוכן
        const uploadWithContent = await Upload.findOne({ content: { $exists: true, $ne: '', $ne: null } });
        if (uploadWithContent) {
            console.log(`\n🎯 דוגמה של upload עם תוכן:`);
            console.log(`  ID: ${uploadWithContent._id}`);
            console.log(`  שם: ${uploadWithContent.originalFileName}`);
            console.log(`  אורך תוכן: ${uploadWithContent.content.length}`);
            console.log(`  תחילת תוכן: "${uploadWithContent.content.substring(0, 200)}..."`);
        }
        
    } catch (error) {
        console.error('❌ שגיאה:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 התנתקות מהמסד');
    }
}

checkActualUploads();