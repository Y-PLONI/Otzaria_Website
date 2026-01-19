import mongoose from 'mongoose';

const OcrExampleSchema = new mongoose.Schema({
  name: { type: String, required: true }, // שם מזהה לדוגמה
  description: { type: String }, 
  scriptType: { type: String, required: true, index: true }, // סוג הכתב: 'rashi', 'square', 'handwriting' וכו'
  layoutType: { type: String, required: true, enum: ['single_column', 'double_column', 'complex_columns'] }, // מבנה העמוד
  imagePath: { type: String, required: true }, // נתיב לתמונה
  expectedOutput: { type: Object, required: true }, // ה-JSON שהמודל אמור להחזיר (OCR תקין)
  prompt: { type: String }, // פרומפט ספציפי לדוגמה זו (אופציונלי)
}, { timestamps: true });

export default mongoose.models.OcrExample || mongoose.model('OcrExample', OcrExampleSchema);