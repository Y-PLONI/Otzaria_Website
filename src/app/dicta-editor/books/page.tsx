"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import Button from "@/components/Button";
import FormInput from "@/components/FormInput";
// import "../dicta-editor.css"; // Removed to use site theme

// Extend session user type to include our custom fields
type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  _id?: string;
  id?: string;
};

type BookItem = {
  _id: string;
  title: string;
  status: string;
  claimedBy?: { _id: string; name: string } | null;
  updatedAt: string;
};

const API_BASE = "/api/dicta";

export default function DictaBooksPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBookTitle, setNewBookTitle] = useState("");
  
  // Cast session user to our extended type
  const user = session?.user as SessionUser | undefined;
  
  // Check if current user is admin
  const isAdmin = user?.role === "admin";
  // Get current user ID
  const currentUserId = user?._id || user?.id;

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/books`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      } else if (res.status === 401) {
        // Not authenticated, redirect to login
        router.push("/library/auth/login");
      }
    } catch (error) {
      console.error("Error loading books:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for session to load
    if (sessionStatus === "loading") return;
    
    if (sessionStatus === "unauthenticated") {
      router.push("/library/auth/login");
      return;
    }
    
    loadBooks();
  }, [sessionStatus, router]);

  const claimBook = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // Navigate to editor with bookId
      router.push(`/dicta-editor?bookId=${id}`);
    } catch (e) {
      alert("שגיאה בתפיסת הספר: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const openBook = (id: string) => {
    router.push(`/dicta-editor?bookId=${id}`);
  };

  const releaseBook = async (id: string) => {
    if (!confirm("האם לשחרר את הספר ולהחזירו למאגר?")) return;
    try {
      const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      loadBooks();
    } catch (e) {
      alert("שגיאה בשחרור הספר: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const deleteBook = async (id: string, title: string) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הספר "${title}"? פעולה זו לא ניתנת לביטול.`)) return;
    try {
      const res = await fetch(`${API_BASE}/books/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      loadBooks();
    } catch (e) {
      alert("שגיאה במחיקת הספר: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const createBook = async () => {
    if (!newBookTitle.trim()) {
      alert("נא להזין שם לספר");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newBookTitle.trim(), content: "" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewBookTitle("");
      loadBooks();
    } catch (e) {
      alert("שגיאה ביצירת ספר: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "available":
        return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-400">פנוי</span>;
      case "in-progress":
        return <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-400">בעריכה</span>;
      case "completed":
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-400">הושלם</span>;
      default:
        return <span>{status}</span>;
    }
  };

  // Check if current user is the owner of the book
  const isOwner = (book: BookItem): boolean => {
    if (!currentUserId || !book.claimedBy) return false;
    return book.claimedBy._id === currentUserId;
  };

  // Check if user can access/edit a book
  const canAccess = (book: BookItem): boolean => {
    if (book.status === "available") return true; // Anyone can claim
    if (isAdmin) return true; // Admin can access all
    return isOwner(book); // Owner can access their own
  };

  // Loading state while session is being checked
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl text-primary">טוען...</div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">
              📚 עורך דיקטה
            </h1>
            <p className="text-on-surface/70">
              שלום, <span className="font-semibold">{user?.name || "משתמש"}</span>
              {isAdmin && (
                <span className="mr-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded border border-primary/20">
                  מנהל
                </span>
              )}
            </p>
          </div>
          <Button 
            variant="ghost" 
            onClick={loadBooks} 
            icon="refresh" 
            label="רענן" 
          />
        </div>

        {/* Create new book - Admin only */}
        {isAdmin && (
          <div className="bg-surface border border-surface-variant rounded-xl p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">add_circle</span>
              יצירת ספר חדש
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                {/* @ts-ignore - JSDoc optional props not picked up */}
                <FormInput
                  placeholder="שם הספר"
                  value={newBookTitle}
                  onChange={(e: { target: { value: string } }) => setNewBookTitle(e.target.value)}
                  // onKeyDown={(e) => e.key === "Enter" && createBook()} - FormInput doesn't support onKeyDown prop in its common definition, check later if needed
                />
              </div>
              <Button 
                onClick={createBook} 
                label="צור ספר" 
                variant="primary"
                disabled={!newBookTitle.trim()}
              />
            </div>
          </div>
        )}

        {/* Book list */}
        <div className="bg-surface rounded-xl border border-surface-variant shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-variant flex justify-between items-center bg-surface-variant/30">
            <h3 className="font-bold text-lg">רשימת ספרים ({books.length})</h3>
            {!isAdmin && (
              <span className="text-sm text-gray-500">
                מוצגים ספרים פנויים וספרים שלך
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">טוען נתונים...</div>
          ) : books.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              {isAdmin ? "אין ספרים עדיין. צור ספר חדש למעלה." : "אין ספרים זמינים לעריכה כרגע."}
            </div>
          ) : (
            <ul className="divide-y divide-surface-variant">
              {books
                .filter((book) => isAdmin || canAccess(book))
                .map((book) => {
                  const userIsOwner = isOwner(book);
                  const canEdit = canAccess(book);
                  
                  return (
                    <li
                      key={book._id}
                      className={`p-6 transition-colors hover:bg-surface-variant/20 ${
                        userIsOwner ? "bg-green-50/50" : ""
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-medium truncate" title={book.title}>{book.title}</h4>
                            {userIsOwner && (
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded border border-green-200">
                                שלי
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {getStatusBadge(book.status)}
                            {book.claimedBy && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">person</span>
                                {book.claimedBy.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">schedule</span>
                              {new Date(book.updatedAt).toLocaleDateString("he-IL")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {book.status === "available" ? (
                            <>
                              <Button
                                variant="primary"
                                onClick={() => claimBook(book._id)}
                                label="תפוס וערוך"
                                icon="edit_document"
                              />
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => deleteBook(book._id, book.title)}
                                  icon="delete"
                                  label=""
                                />
                              )}
                            </>
                          ) : canEdit ? (
                            <>
                              <Button
                                variant="primary"
                                onClick={() => openBook(book._id)}
                                label="פתח לעריכה"
                                icon="edit"
                              />
                              {(userIsOwner || isAdmin) && (
                                <Button
                                  variant="outline"
                                  onClick={() => releaseBook(book._id)}
                                  label="שחרר"
                                />
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => deleteBook(book._id, book.title)}
                                  icon="delete"
                                  label=""
                                />
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm italic">
                              בעריכה על ידי אחר
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm bg-surface/50 p-4 rounded-lg">
          <span className="material-symbols-outlined align-middle mr-2 text-primary">lightbulb</span>
          {isAdmin 
            ? "כמנהל, יש לך גישה לכל הספרים. לחץ על 'תפוס וערוך' כדי להתחיל."
            : "לחץ 'תפוס וערוך' כדי להתחיל לערוך ספר פנוי. ספרים שתפסת מסומנים בירוק."
          }
        </div>
      </div>
    </div>
  );
}
