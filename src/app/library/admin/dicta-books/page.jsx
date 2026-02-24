'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AdminDictaBooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true) // טעינת נתונים ראשונית
  const [syncing, setSyncing] = useState(false) // סטטוס סנכרון
  
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookContent, setNewBookContent] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  
  const [editingBook, setEditingBook] = useState(null)
  const [editStatus, setEditStatus] = useState('')

  // 1. בדיקת הרשאות והפניה
  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/library/auth/login')
    } else if (session?.user?.role !== 'admin') {
      router.push('/library/dashboard')
    } else {
      loadBooks()
    }
  }, [status, session, router])

  const loadBooks = async () => {
    try {
      // setLoading(true) - לא נאפס טעינה כדי לא להבהב במסך אם רק מרעננים רשימה
      const response = await fetch('/api/dicta/books')
      if (response.ok) {
        const data = await response.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Error loading dicta books:', error)
    } finally {
      setLoading(false)
    }
  }

  // 2. לוגיקת סנכרון מול GitHub
  const handleSync = async () => {
    if (!confirm('האם לסנכרן ספרים מ-GitHub? הפעולה עשויה לקחת זמן.')) return

    setSyncing(true)
    try {
      const response = await fetch('/api/dicta/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'dicta-sync' }) // קריאה לכלי הסנכרון בצד שרת
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // הצגת סיכום הלוג בצורה קריאה
        const summary = data.log.length > 0 
            ? data.log.join('\n') 
            : 'הסנכרון הסתיים, לא היו שינויים.';
            
        alert(`הסנכרון הושלם בהצלחה!\n\n${summary}`)
        loadBooks() // רענון הרשימה
      } else {
        alert(`שגיאה בסנכרון: ${data.detail || data.error || 'שגיאה לא ידועה'}`)
      }
    } catch (e) {
      console.error(e)
      alert('שגיאת תקשורת בעת ביצוע הסנכרון')
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) return alert('נא להזין שם לספר')
    
    try {
      const response = await fetch('/api/dicta/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newBookTitle,
          content: newBookContent
        })
      })
      
      if (response.ok) {
        setNewBookTitle('')
        setNewBookContent('')
        setShowCreateForm(false)
        loadBooks()
        alert('הספר נוצר בהצלחה!')
      } else {
        const data = await response.json()
        alert(data.error || 'שגיאה ביצירת הספר')
      }
    } catch (e) {
      alert('שגיאה ביצירת הספר')
    }
  }

  const handleDeleteBook = async (bookId, bookTitle) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הספר "${bookTitle}"?`)) return
    
    try {
      const response = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setBooks(prev => prev.filter(b => b._id !== bookId))
        alert('הספר נמחק בהצלחה!')
      } else {
        alert('שגיאה במחיקת הספר')
      }
    } catch (e) {
      alert('שגיאה במחיקת הספר')
    }
  }

  const handleReleaseBook = async (bookId) => {
    try {
      const response = await fetch(`/api/dicta/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release' })
      })
      
      if (response.ok) {
        loadBooks()
        alert('הספר שוחרר בהצלחה!')
      } else {
        alert('שגיאה בשחרור הספר')
      }
    } catch (e) {
      alert('שגיאה בשחרור הספר')
    }
  }

  const handleEditStatus = (book) => {
    setEditingBook(book)
    setEditStatus(book.status)
  }

  const handleSaveStatus = async () => {
    if (!editingBook) return
    
    try {
      const response = await fetch(`/api/dicta/books/${editingBook._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus })
      })
      
      if (response.ok) {
        loadBooks()
        setEditingBook(null)
        alert('הסטטוס עודכן בהצלחה!')
      } else {
        alert('שגיאה בעדכון הסטטוס')
      }
    } catch (e) {
      alert('שגיאה בעדכון הסטטוס')
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'available': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">פנוי</span>
      case 'in-progress': return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">בעריכה</span>
      case 'completed': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">הושלם</span>
      default: return status
    }
  }

  // מסך טעינה מלא במידה ועדיין בודקים הרשאות או טוענים נתונים ראשוניים
  if (status === 'loading' || (loading && books.length === 0)) return (
    <div className="flex justify-center items-center h-64">
      <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
    </div>
  )

  // אם המשתמש לא אדמין (למרות שה-useEffect אמור להעיף אותו, זה מונע ריצוד)
  if (session?.user?.role !== 'admin') return null;

  return (
    <>
      <div className="glass-strong p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">edit_document</span>
          ניהול ספרי דיקטה
        </h2>
        
        <div className="flex gap-3">
            {/* כפתור סנכרון חדש */}
            <button 
                onClick={handleSync}
                disabled={syncing}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
                {syncing ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                ) : (
                    <span className="material-symbols-outlined text-sm">cloud_sync</span>
                )}
                {syncing ? 'מסנכרן...' : 'סנכרון מ-GitHub'}
            </button>

            <button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-2 shadow-sm"
            >
                <span className="material-symbols-outlined text-sm">add</span>
                הוסף ספר חדש
            </button>
        </div>
      </div>

      {/* טופס יצירת ספר */}
      {showCreateForm && (
        <div className="mb-6 p-4 bg-surface-variant rounded-lg border border-gray-200">
          <h3 className="font-bold mb-4">יצירת ספר חדש ידנית</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1 font-medium">שם הספר</label>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-primary outline-none"
                placeholder="הזן שם לספר"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">תוכן התחלתי (אופציונלי)</label>
              <textarea
                value={newBookContent}
                onChange={(e) => setNewBookContent(e.target.value)}
                className="w-full p-2 border rounded h-32 focus:ring-2 focus:ring-primary outline-none"
                placeholder="הדבק כאן טקסט התחלתי..."
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleCreateBook}
                className="bg-primary text-on-primary px-4 py-2 rounded hover:bg-primary/90 font-medium"
              >
                צור ספר
              </button>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 font-medium"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* רשימת ספרים */}
      {books.length === 0 ? (
        <div className="text-center py-12 text-on-surface/60 border-2 border-dashed border-gray-300 rounded-xl">
          <span className="material-symbols-outlined text-6xl mb-4 block opacity-50">library_books</span>
          <p className="text-lg font-medium">אין ספרי דיקטה במערכת</p>
          <p className="text-sm mt-2">לחץ על "סנכרון מ-GitHub" לייבוא ספרים או "הוסף ספר חדש"</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full bg-white">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 text-sm">
                <th className="text-right p-4 font-bold">שם הספר</th>
                <th className="text-right p-4 font-bold">סטטוס</th>
                <th className="text-right p-4 font-bold">נערך ע"י</th>
                <th className="text-right p-4 font-bold">עדכון אחרון</th>
                <th className="text-center p-4 font-bold">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map(book => (
                <tr key={book._id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{book.title}</td>
                  <td className="p-4">{getStatusBadge(book.status)}</td>
                  <td className="p-4 text-sm">{book.claimedBy?.name || '-'}</td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(book.updatedAt).toLocaleDateString('he-IL', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      {book.status === 'in-progress' && (
                        <button
                          onClick={() => handleReleaseBook(book._id)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="שחרר ספר (בטל נעילה)"
                        >
                          <span className="material-symbols-outlined">lock_open</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleEditStatus(book)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="ערוך סטטוס"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book._id, book.title)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="מחק ספר"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
      
    {editingBook && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 h-screen w-screen">
        <div 
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative" 
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-lg text-gray-800">עריכת סטטוס ספר</h3>
            <button onClick={() => setEditingBook(null)} className="text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 p-1">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">שם הספר</label>
              <div className="w-full p-3 bg-gray-50 rounded-lg text-gray-600 border border-gray-200">
                {editingBook.title}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary outline-none bg-white"
              >
                <option value="available">פנוי</option>
                <option value="in-progress">בעריכה</option>
                <option value="completed">הושלם</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => setEditingBook(null)}
                className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                ביטול
              </button>
              <button 
                onClick={handleSaveStatus}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium shadow-sm transition-colors"
              >
                שמור שינויים
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}