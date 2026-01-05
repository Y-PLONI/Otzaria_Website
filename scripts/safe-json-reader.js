/**
 * פונקציות עזר לקריאת קבצי JSON גדולים
 */

const fs = require('fs');
const readline = require('readline');

/**
 * קריאת קובץ JSON גדול בצורה בטוחה
 */
async function readLargeJsonFile(filePath) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        let content = '';
        let braceCount = 0;
        let isFirstObject = true;
        
        fileStream.on('data', (chunk) => {
            content += chunk.toString();
        });
        
        fileStream.on('end', () => {
            try {
                // ננסה לפרס את כל הקובץ
                const parsed = JSON.parse(content);
                resolve(parsed);
            } catch (error) {
                // אם זה לא עובד, ננסה לחלק לאובייקטים
                const objects = [];
                let currentObject = '';
                braceCount = 0;
                
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    currentObject += char;
                    
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                    
                    if (braceCount === 0 && currentObject.trim()) {
                        try {
                            const obj = JSON.parse(currentObject.trim());
                            objects.push(obj);
                            currentObject = '';
                        } catch (e) {
                            // המשך לתו הבא
                        }
                    }
                }
                
                resolve(objects);
            }
        });
        
        fileStream.on('error', reject);
    });
}

/**
 * קריאת קובץ JSON בחלקים קטנים (streaming)
 */
async function streamJsonObjects(filePath, callback) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        let buffer = '';
        let braceCount = 0;
        let objectCount = 0;
        
        fileStream.on('data', (chunk) => {
            buffer += chunk.toString();
            
            // עיבוד האובייקטים שנמצאים בבאפר
            let i = 0;
            while (i < buffer.length) {
                const char = buffer[i];
                
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                
                if (braceCount === 0 && buffer.substring(0, i + 1).trim()) {
                    const objectStr = buffer.substring(0, i + 1).trim();
                    try {
                        const obj = JSON.parse(objectStr);
                        callback(obj, objectCount++);
                        buffer = buffer.substring(i + 1);
                        i = 0;
                        continue;
                    } catch (e) {
                        // לא אובייקט תקין, המשך
                    }
                }
                i++;
            }
        });
        
        fileStream.on('end', () => {
            // עיבוד מה שנשאר בבאפר
            if (buffer.trim()) {
                try {
                    const obj = JSON.parse(buffer.trim());
                    callback(obj, objectCount++);
                } catch (e) {
                    // לא אובייקט תקין
                }
            }
            resolve(objectCount);
        });
        
        fileStream.on('error', reject);
    });
}

module.exports = {
    readLargeJsonFile,
    streamJsonObjects
};