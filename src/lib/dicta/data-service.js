import connectDB from "@/lib/db";
import DictaBook from "@/models/DictaBook";

export async function getBookContent(bookId) {
  await connectDB();
  const book = await DictaBook.findById(bookId);
  if (!book) throw new Error("הספר לא נמצא");
  return book.content || "";
}

export async function getBookLines(bookId) {
  const content = await getBookContent(bookId);
  return content.split(/\r?\n/);
}

export async function saveBookContent(bookId, content) {
  await connectDB();
  const book = await DictaBook.findById(bookId);
  if (!book) throw new Error("הספר לא נמצא");
  book.content = content;
  // אופציונלי: כאן אפשר להוסיף לוגיקה של שמירת היסטוריה
  await book.save();
}

export async function saveBookLines(bookId, lines) {
  await saveBookContent(bookId, lines.join("\n"));
}