import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import DictaBook from "@/models/DictaBook";

// ייבוא הלוגיקה העסקית מהקבצים החדשים בספרייה
import { 
  addPageNumberToHeadingDB,
  changeHeadingLevelDB,
  createHeadersDB,
  createSingleLetterHeadersDB,
  createPageBHeadersDB,
  replacePageBHeadersDB,
  emphasizeAndPunctuateDB,
  textCleanerDB,
  headerErrorCheckerDB
} from "@/lib/dicta/text-processors";

import { dictaSync } from "@/lib/dicta/github-sync";

// מפת הכלים - קישור בין שם הפעולה לפונקציה המבצעת
const toolHandlers = {
  "add-page-number": async (params) => {
    return addPageNumberToHeadingDB(params.book_id, params.replace_with);
  },

  "change-heading-level": async (params) => {
    return changeHeadingLevelDB(params.book_id, params.current_level, params.new_level);
  },

  "create-headers": async (params) => {
    return createHeadersDB(
      params.book_id, 
      params.find_word, 
      Number(params.end), 
      Number(params.level_num)
    );
  },

  "create-single-letter-headers": async (params) => {
    return createSingleLetterHeadersDB(
      params.book_id,
      params.end_suffix,
      Number(params.end),
      Number(params.level_num),
      Array.isArray(params.ignore) ? params.ignore : [],
      params.start,
      Array.isArray(params.remove) ? params.remove : [],
      Boolean(params.bold_only)
    );
  },

  "create-page-b-headers": async (params) => {
    return createPageBHeadersDB(params.book_id, Number(params.header_level));
  },

  "replace-page-b-headers": async (params) => {
    return replacePageBHeadersDB(params.book_id, params.replace_type);
  },

  "emphasize-and-punctuate": async (params) => {
    return emphasizeAndPunctuateDB(
      params.book_id, 
      params.add_ending, 
      Boolean(params.emphasize_start)
    );
  },

  "text-cleaner": async (params) => {
    return textCleanerDB(params.book_id, params.options || {});
  },

  "header-error-checker": async (params) => {
    return headerErrorCheckerDB(
      params.book_id,
      params.re_start,
      params.re_end,
      Boolean(params.gershayim),
      Boolean(params.is_shas)
    );
  },

  "dicta-sync": async (params) => {
    // ניתן להעביר נתיב תיקייה מותאם אישית, או להשתמש בברירת המחדל
    return dictaSync(params.folder_path);
  }
};

/**
 * בדיקת הרשאות גישה לספר
 */
async function checkBookAccess(bookId, userId, isAdmin) {
  if (!bookId) return { allowed: true }; // כלים שלא דורשים ספר (כמו סנכרון)

  await connectDB();
  const book = await DictaBook.findById(bookId);
  
  if (!book) {
    return { allowed: false, error: "הספר לא נמצא" };
  }
  
  // ספר בסטטוס 'בטיפול' - רק לבעלים או לאדמין
  if (book.status === "in-progress") {
    const isOwner = book.claimedBy?.toString() === userId;
    if (!isAdmin && !isOwner) {
      return { allowed: false, error: "אין גישה: הספר נמצא בטיפול אצל משתמש אחר" };
    }
  }
  
  // ספר בסטטוס 'הושלם' - רק לאדמין (למנוע שינויים בטעות) או לבעלים המקורי
  if (book.status === "completed") {
     const isOwner = book.claimedBy?.toString() === userId;
     if (!isAdmin && !isOwner) {
        return { allowed: false, error: "הספר הושלם ונעול לעריכה" };
     }
  }
  
  return { allowed: true };
}

export async function POST(request) {
  try {
    // 1. אימות משתמש
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    
    const user = session.user;
    const userId = user._id || user.id;
    const isAdmin = user.role === "admin";

    // 2. קריאת הבקשה
    const body = await request.json();
    const { tool, ...params } = body;

    if (!tool || typeof tool !== "string") {
      return NextResponse.json({ detail: "יש לציין את שם הכלי (tool)" }, { status: 400 });
    }

    const handler = toolHandlers[tool];
    if (!handler) {
      return NextResponse.json({ detail: `כלי לא מוכר: ${tool}` }, { status: 400 });
    }

    // 3. בדיקת הרשאות ספציפית לספר (אם נשלח ID)
    if (params.book_id) {
      const access = await checkBookAccess(params.book_id, userId, isAdmin);
      if (!access.allowed) {
        return NextResponse.json({ detail: access.error }, { status: 403 });
      }
    } else if (tool === 'dicta-sync' && !isAdmin) {
        // רק אדמין יכול לבצע סנכרון מערכת
        return NextResponse.json({ detail: "פעולה זו מותרת למנהלים בלבד" }, { status: 403 });
    }

    // 4. הפעלת הכלי
    const result = await handler(params);
    return NextResponse.json(result);

  } catch (err) {
    console.error(`Error in tool ${request.body?.tool}:`, err);
    return NextResponse.json({ detail: err.message || "שגיאת שרת פנימית" }, { status: 500 });
  }
}