import crypto from 'crypto';

// הגדרת האלגוריתם והמפתח
const ALGORITHM = 'aes-256-cbc';

// יצירת מפתח הצפנה מתוך הסיסמה הראשית של המערכת (או ברירת מחדל לפיתוח)
// scryptSync מבטיח שהמפתח יהיה בדיוק באורך 32 בייט שנדרש ל-aes-256
const KEY = crypto.scryptSync(process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-me', 'salt', 32);

const IV_LENGTH = 16; // אורך וקטור האתחול

/**
 * פונקציה להצפנת טקסט (למשל כתובת מייל)
 */
export function encryptToken(text) {
    if (!text) return null;
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // מחזירים את ה-IV והטקסט המוצפן מופרדים בנקודתיים
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * פונקציה לפענוח הטוקן חזרה לטקסט מקורי
 */
export function decryptToken(token) {
    try {
        if (!token) return null;

        const textParts = token.split(':');
        // וודא שיש לנו שני חלקים (IV ו-תוכן)
        if (textParts.length !== 2) return null;

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted.toString();
    } catch (error) {
        // במקרה של טוקן לא תקין או שגיאת פענוח
        // console.error('Token decryption failed:', error.message);
        return null;
    }
}