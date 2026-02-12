import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'נא להזין שם לקטגוריה'],
    trim: true,
    unique: true, // מונע כפילויות בשמות
  },
  color: {
    type: String,
    default: '#64748b', // צבע ברירת מחדל (אפור)
  },
  order: {
    type: Number,
    default: 0, // לשימוש עתידי אם תרצה לשנות סדר תצוגה
  }
}, {
  timestamps: true // מוסיף אוטומטית created_at ו-updated_at
});

// בדיקה האם המודל כבר קיים (מונע שגיאות ב-Next.js בזמן Hot Reload)
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

export default Category;