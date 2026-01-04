import { RateLimiter } from "limiter";

const limiters = new Map();

/**
 * בדיקת מגבלת קצב (Rate Limit)
 * @param {string} key - מזהה ייחודי (למשל IP + נתיב)
 * @param {string} action - שם הפעולה (למשל 'login', 'register')
 * @param {number} tokens - כמות הבקשות המותרות
 * @param {string} interval - חלון הזמן ('minute', 'hour', 'day')
 * @returns {boolean} - האם הבקשה מותרת
 */
export function checkRateLimit(ip, action, tokens = 10, interval = "minute") {
    const key = `${ip}:${action}`;
    
    if (!limiters.has(key)) {
        limiters.set(key, new RateLimiter({ tokensPerInterval: tokens, interval: interval }));
    }

    const limiter = limiters.get(key);
    return limiter.tryRemoveTokens(1);
}